import express from 'express'
import firebase from 'firebase-admin'
import _ from 'lodash'

import Side from '../shared/side'

const app = express()
app.use(express.json())

firebase.initializeApp({
    credential: process.env.FIREBASE_SERVICE_ACCOUNT_KEY ? firebase.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY))
        : firebase.credential.applicationDefault()
})
const firestore = firebase.firestore()

app.get('/api/v1', (_, res) => res.sendStatus(200))

app.post('/api/v1/orders', (req, res, next) => {
    const instrument = req.body.instrument
    if (!_.isString(instrument) || instrument.length <= 0) {
        res.status(422).send({error: `Invalid instrument value: ${req.body.instrument}`})
        return
    }

    const side = req.body.side
    if (side !== Side.BUY && side !== Side.SELL) {
        res.status(422).send({error: `Invalid side value: ${req.body.side}`})
        return
    }

    const volume = parseInt(req.body.volume, 10)
    if (Number.isNaN(volume) || volume <= 0) {
        res.status(422).send({error: `Invalid volume value: ${req.body.volume}`})
        return
    }

    const price = parseFloat(req.body.price)
    if (Number.isNaN(price) || price <= 0) {
        res.status(422).send({error: `Invalid price value: ${req.body.price}`})
        return
    }

    firestore.runTransaction(async (t) => {
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
    .then((id) => {
        res.status(201).send({id: id})
    })
    .catch((error) => {
        next(error)
    })
})

app.get('/api/v1/orders/:id', (req, res, next) => {
    firestore.collection('orders').doc(req.params.id).get()
    .then((order) => {
        if (order.exists) {
            const data = order.data()
            res.send({
                id: order.ref.id,
                instrument: data.instrument,
                side: data.side,
                total_volume: data.total_volume,
                active_volume: data.active_volume,
                filled_volume: data.filled_volume,
                price: data.price,
                related_trades: data.related_trades.map((t: FirebaseFirestore.DocumentReference) => t.id),
                create_time: order.createTime?.toMillis() ?? 0
            })
        } else {
            res.status(404).send({error: `No order for id: ${req.params.id}`})
        }
    })
    .catch((error) => {
        next(error)
    })
})

app.delete('/api/v1/orders/:id', (req, res, next) => {
    firestore.collection('orders').doc(req.params.id).update({active_volume: 0})
    .then(() => res.send({}))
    .catch((error) => {
        if (error.code === firebase.firestore.GrpcStatus.NOT_FOUND) {
            res.status(404).send({error: `No order for id: ${req.params.id}`})
        } else {
            next(error)
        }
    })
})

app.get('/api/v1/trades/:id', (req, res, next) => {
    firestore.collection('trades').doc(req.params.id).get()
    .then((trade) => {
        if (trade.exists) {
            const data = trade.data()
            res.send({
                volume: data.volume,
                price: data.price,
                related_orders: data.related_orders.map((t: FirebaseFirestore.DocumentReference) => t.id)
            })
        } else {
            res.status(404).send({error: `No trade for id: ${req.params.id}`})
        }
    })
    .catch((error) => {
        next(error)
    })
})

app.get('/api/v1/orderbooks/:instrument', (req, res, next) => {
    firestore.collection('orders')
        .where('instrument', '==', req.params.instrument)
        .where('active_volume', '>', 0)
        .get()
        .then((orders) => {
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

            res.send({
                [Side.BUY]: split[0],
                [Side.SELL]: split[1]
            })
        })
        .catch((error) => {
            next(error)
        })
})

app.use(express.static('./static'))

app.listen(process.env.PORT, () => {
    console.log(`Server running on ${process.env.PORT}`)
})
