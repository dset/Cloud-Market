import Path from 'path'
import Hapi from '@hapi/hapi'
import Inert from '@hapi/inert'
import Boom from '@hapi/boom'
import Joi from 'joi'
import firebase from 'firebase-admin'
import _ from 'lodash'

import Side from '../shared/side'
import CreateOrderParam from '../shared/create-order-param'

firebase.initializeApp({
    credential: process.env.FIREBASE_SERVICE_ACCOUNT_KEY ? firebase.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY))
        : firebase.credential.applicationDefault()
})
const firestore = firebase.firestore()

const server = Hapi.server({
    port: process.env.PORT,
    host: '0.0.0.0'
})

server.route({
    method: 'GET',
    path: '/api/v1/',
    handler: () => {
        return {}
    }
})

server.route({
    method: 'POST',
    path: '/api/v1/orders',
    options: {
        validate: {
            payload: Joi.object({
                instrument: Joi.string().min(1).max(200),
                side: Joi.string().valid(Side.BUY, Side.SELL),
                volume: Joi.number().greater(0).max(1.0e9),
                price: Joi.number().greater(0).max(1.0e6)
            })
        }
    },
    handler: async (request, h) => {
        const {instrument, side, volume, price} = request.payload as CreateOrderParam
        const user = request.auth.credentials.user

        const id = await firestore.runTransaction(async (t) => {
            const query = firestore.collection('orders')
                .where('instrument', '==', instrument)
                .where('side', '==', side === Side.BUY ? Side.SELL : Side.BUY) // Not allowed to have inequality filter on more than one property
                .where('active_volume', '>', 0)

            const orders = await t.get(query)
            const orderbook = orders.docs.sort((a, b) => (side === Side.BUY ? 1.0 : -1.0) * (a.data().price - b.data().price))

            const newOrderRef = firestore.collection('orders').doc()
            const trades: FirebaseFirestore.DocumentReference<FirebaseFirestore.DocumentData>[] = []

            let remainingVolume = volume;
            for (const order of orderbook) {
                const orderVolume = order.data().active_volume
                const orderPrice = order.data().price

                if ((side === Side.BUY && price < orderPrice) || (side === Side.SELL && price > orderPrice)) {
                    break;
                }

                if (user === order.data().user) {
                    // We don't match a user against their own orders
                    continue
                }

                const matchingVolume = Math.min(remainingVolume, orderVolume)
                const trade = firestore.collection('trades').doc()
                trades.push(trade)

                t.create(trade, {
                    volume: matchingVolume,
                    price: orderPrice,
                    related_orders: [newOrderRef, order.ref],
                    users: [user, order.data().user]
                })
                    .update(order.ref, {
                        active_volume: orderVolume - matchingVolume,
                        related_trades: [...(order.data().related_trades ?? []), trade],
                        filled_volume: (order.data().filled_volume ?? 0) + matchingVolume
                    })

                remainingVolume -= matchingVolume
                if (remainingVolume <= 0) {
                    break;
                }
            }

            t.create(newOrderRef, {
                user: user,
                instrument: instrument,
                side: side,
                total_volume: volume,
                active_volume: remainingVolume,
                filled_volume: volume - remainingVolume,
                price: price,
                related_trades: trades
            })

            return newOrderRef.id
        })

        return h.response({id: id}).code(201)
    }
})

// It would be really nice to leverage firebase's built-in access control, but if I'm reading this correctly, it is not possible?
// https://stackoverflow.com/questions/52176402/how-to-make-firebase-functions-act-as-a-user-instead-of-being-an-admin
function verifyOwner(request: Hapi.Request, order: FirebaseFirestore.DocumentSnapshot) {
    if (request.auth.credentials.user !== order.data().user) {
        throw Boom.unauthorized()
    }
}

function toApiOrder(order: FirebaseFirestore.DocumentSnapshot) {
    const data = order.data()
    return {
        id: order.ref.id,
        instrument: data.instrument,
        side: data.side,
        total_volume: data.total_volume,
        active_volume: data.active_volume,
        filled_volume: data.filled_volume,
        price: data.price,
        related_trades: data.related_trades.map((t: FirebaseFirestore.DocumentReference) => t.id),
        create_time: order.createTime?.toMillis() ?? 0
    }
}

server.route({
    method: 'GET',
    path: '/api/v1/user/orders',
    handler: async (request) => {
        const orders = await firestore.collection('orders')
            .where('user', '==', request.auth.credentials.user)
            .get()

        return orders.docs.map(toApiOrder).sort((a, b) => a.create_time - b.create_time)
    }
})

server.route({
    method: 'GET',
    path: '/api/v1/orders/{id}',
    handler: async (request) => {
        const order = await firestore.collection('orders').doc(request.params.id).get()
        if (!order.exists) {
            throw Boom.notFound(`No order for id: ${request.params.id}`)
        }

        verifyOwner(request, order)
        return toApiOrder(order)
    }
})

server.route({
    method: 'DELETE',
    path: '/api/v1/orders/{id}',
    handler: async (request) => {
        const doc = firestore.collection('orders').doc(request.params.id)

        const order = await doc.get()
        if (!order.exists) {
            throw Boom.notFound(`No order for id: ${request.params.id}`)
        }

        verifyOwner(request, order)

        await doc.update({active_volume: 0})
        return {}
    }
})

server.route({
    method: 'GET',
    path: '/api/v1/trades/{id}',
    handler: async (request) => {
        const trade = await firestore.collection('trades').doc(request.params.id).get()
        if (!trade.exists) {
            throw Boom.notFound(`No trade for id: ${request.params.id}`)
        }

        const data = trade.data()
        if (!data.users.includes(request.auth.credentials.user)) {
            throw Boom.unauthorized()
        }

        return {
            volume: data.volume,
            price: data.price,
            related_orders: data.related_orders.map((t: FirebaseFirestore.DocumentReference) => t.id)
        }
    }
})

server.route({
    method: 'GET',
    path: '/api/v1/orderbooks/{instrument}',
    handler: async (request) => {
        const orders = await firestore.collection('orders')
            .where('instrument', '==', request.params.instrument)
            .where('active_volume', '>', 0)
            .get()

        const split = _.chain(orders.docs)
            .map((doc) => doc.data())
            .map((order) => ({
                instrument: order.instrument,
                side: order.side,
                volume: order.active_volume,
                price: order.price
            }))
            .partition((order) => order.side === Side.BUY)
            .value()

        split[0].sort((a, b) => b.price - a.price)
        split[1].sort((a, b) => a.price - b.price)

        return {
            [Side.BUY]: split[0],
            [Side.SELL]: split[1]
        }
    }
})

server.auth.scheme('firebase-jwt', () => {
    return {
        authenticate: async (request, h) => {
            const auth = request.headers.authorization ?? ""
            if (auth.startsWith('Bearer ')) {
                try {
                    const decoded = await firebase.auth().verifyIdToken(auth.substring(7))
                    return h.authenticated({credentials: {user: decoded.uid}})
                } catch (error) {
                    return h.unauthenticated(Boom.unauthorized())
                }
            } else {
                return h.unauthenticated(Boom.unauthorized())
            }
        }
    }
})

server.auth.strategy('firebase-auth', 'firebase-jwt')
server.auth.default('firebase-auth')

export async function init() {
    await server.initialize();
    return server;
};

export async function start() {
    await server.register(Inert)

    server.route({
        method: 'GET',
        path: '/{param*}',
        options: {
            auth: false
        },
        handler: {
            directory: {
                path: Path.join(__dirname, 'static')
            }
        }
    });

    await server.start();

    console.log(`Server running at: ${server.info.uri}`);
    return server;
};

process.on('unhandledRejection', (err) => {
    console.log(err);
    process.exit(1);
});
