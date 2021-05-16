import Hapi from '@hapi/hapi'
import Lab from '@hapi/lab'
import {expect} from '@hapi/code'
import {v4 as uuidv4} from 'uuid'
import {init} from '../server'
import Side from '../../shared/side'
import Id from '../../shared/id'
import Order from '../../shared/order'
import Trade from '../../shared/trade'
import Orderbook from '../../shared/orderbook'

const lab = Lab.script()
const {afterEach, beforeEach, describe, it} = lab
export {lab}

describe('Server', () => {
    let server: Hapi.Server
    let instrument: string

    function postOrder(payload: any) {
        return server.inject({
            method: 'POST',
            url: '/api/v1/orders',
            payload: payload
        })
    }

    function getOrder(id: Id) {
        return server.inject({
            method: 'GET',
            url: `/api/v1/orders/${id.id}`
        })
    }

    function deleteOrder(id: Id) {
        return server.inject({
            method: 'DELETE',
            url: `/api/v1/orders/${id.id}`
        })
    }

    function getTrade(id: string) {
        return server.inject({
            method: 'GET',
            url: `/api/v1/trades/${id}`
        })
    }

    beforeEach(async () => {
        server = await init()
        instrument = uuidv4()
    })

    afterEach(async () => {
        await server.stop()
    })

    describe('GET api root', () => {
        it('responds with 200', async () => {
            const res = await server.inject({
                method: 'GET',
                url: '/api/v1/'
            })

            expect(res.statusCode).to.equal(200)
        })
    })

    describe('POST orders', () => {
        it('responds with 400 on invalid instrument', async () => {
            const res = await postOrder({instrument: '', side: Side.BUY, volume: 1000, price: 10})
            expect(res.statusCode).to.equal(400)
        })

        it('responds with 400 on invalid side', async () => {
            const res = await postOrder({instrument: '__test', side: '', volume: 1000, price: 10})
            expect(res.statusCode).to.equal(400)
        })

        it('responds with 400 on invalid volume', async () => {
            const res = await postOrder({instrument: '__test', side: Side.BUY, volume: 0, price: 10})
            expect(res.statusCode).to.equal(400)
        })

        it('responds with 400 on invalid price', async () => {
            const res = await postOrder({instrument: '__test', side: Side.BUY, volume: 1000, price: 0})
            expect(res.statusCode).to.equal(400)
        })

        it('creates basic order', async () => {
            const created = await postOrder({instrument: instrument, side: Side.BUY, volume: 1000, price: 10})
            expect(created.statusCode).to.equal(201)
            const id = created.result as Id

            const res = await getOrder(id)
            expect(res.statusCode).to.equal(200)

            const order = res.result as Order
            expect(order.id).to.equal(id.id)
            expect(order.instrument).to.equal(instrument)
            expect(order.side).to.equal(Side.BUY)
            expect(order.total_volume).to.equal(1000)
            expect(order.active_volume).to.equal(1000)
            expect(order.filled_volume).to.equal(0)
            expect(order.price).to.equal(10)
            expect(order.related_trades).to.equal([])
        })

        it('creates basic trades', async () => {
            const created1 = await postOrder({instrument: instrument, side: Side.BUY, volume: 1000, price: 10})
            expect(created1.statusCode).to.equal(201)

            const created2 = await postOrder({instrument: instrument, side: Side.SELL, volume: 1000, price: 10})
            expect(created2.statusCode).to.equal(201)

            for (const id of [created1.result as Id, created2.result as Id]) {
                const order = (await getOrder(id)).result as Order
                expect(order.active_volume).to.equal(0)
                expect(order.filled_volume).to.equal(1000)
                expect(order.related_trades).to.have.length(1)

                const trade = (await getTrade(order.related_trades[0])).result as Trade
                expect(trade.volume).to.equal(1000)
                expect(trade.price).to.equal(10)
            }
        })
    })

    describe('GET orders', () => {
        it('responds with 404 on missing order', async () => {
            const res = await getOrder({id: 'non-existent'})
            expect(res.statusCode).to.equal(404)
        })
    })

    describe('DELETE orders', () => {
        it('responds with 404 on missing order', async () => {
            const res = await deleteOrder({id: 'non-existent'})
            expect(res.statusCode).to.equal(404)
        })

        it('sets active volume to 0', async () => {
            const created = await postOrder({instrument: instrument, side: Side.BUY, volume: 1000, price: 10})
            const deleted = await deleteOrder(created.result as Id)
            expect(deleted.statusCode).to.equal(200)

            const order = (await getOrder(created.result as Id)).result as Order
            expect(order.active_volume).to.equal(0)
        })
    })

    describe('GET trades', () => {
        it('responds with 404 on missing trade', async () => {
            const res = await getTrade('non-existent')
            expect(res.statusCode).to.equal(404)
        })
    })

    describe('GET orderbooks', () => {
        it('responds with orderbook', async () => {
            await postOrder({instrument: instrument, side: Side.BUY, volume: 2000, price: 10})
            await postOrder({instrument: instrument, side: Side.BUY, volume: 1000, price: 11})
            await postOrder({instrument: instrument, side: Side.SELL, volume: 500, price: 11})
            await postOrder({instrument: instrument, side: Side.SELL, volume: 3000, price: 13})

            const res = await server.inject({
                method: 'GET',
                url: `/api/v1/orderbooks/${instrument}`
            })
            expect(res.statusCode).to.equal(200)

            const expected: Orderbook = {
                [Side.BUY]: [
                    {
                        instrument: instrument,
                        side: Side.BUY,
                        volume: 500,
                        price: 11
                    },
                    {
                        instrument: instrument,
                        side: Side.BUY,
                        volume: 2000,
                        price: 10
                    }
                ],
                [Side.SELL]: [
                    {
                        instrument: instrument,
                        side: Side.SELL,
                        volume: 3000,
                        price: 13
                    }
                ]
            }
            expect(res.result).to.equal(expected)
        })
    })
})
