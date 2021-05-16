import Path from 'path'
import Hapi from '@hapi/hapi'
import Inert from '@hapi/inert'
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

                const matchingVolume = Math.min(remainingVolume, orderVolume)
                const trade = firestore.collection('trades').doc()
                trades.push(trade)

                t.create(trade, {
                    volume: matchingVolume,
                    price: orderPrice,
                    related_orders: [newOrderRef, order.ref]
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

server.route({
    method: 'GET',
    path: '/api/v1/orders/{id}',
    handler: async (request, h) => {
        const order = await firestore.collection('orders').doc(request.params.id).get()
        if (order.exists) {
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
        } else {
            return h.response({error: `No order for id: ${request.params.id}`}).code(404)
        }
    }
})

server.route({
    method: 'DELETE',
    path: '/api/v1/orders/{id}',
    handler: async (request, h) => {
        try {
            await firestore.collection('orders').doc(request.params.id).update({active_volume: 0})
            return {}
        } catch (error) {
            if (error.code === firebase.firestore.GrpcStatus.NOT_FOUND) {
                return h.response({error: `No order for id: ${request.params.id}`}).code(404)
            } else {
                throw error
            }
        }
    }
})

server.route({
    method: 'GET',
    path: '/api/v1/trades/{id}',
    handler: async (request, h) => {
        const trade = await firestore.collection('trades').doc(request.params.id).get()
        if (trade.exists) {
            const data = trade.data()
            return {
                volume: data.volume,
                price: data.price,
                related_orders: data.related_orders.map((t: FirebaseFirestore.DocumentReference) => t.id)
            }
        } else {
            return h.response({error: `No trade for id: ${request.params.id}`}).code(404)
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

export async function init() {
    await server.initialize();
    return server;
};

export async function start() {
    await server.register(Inert)

    server.route({
        method: 'GET',
        path: '/{param*}',
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
