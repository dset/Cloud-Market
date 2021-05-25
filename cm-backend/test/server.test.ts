import Hapi from '@hapi/hapi'
import Lab from '@hapi/lab'
import {expect} from '@hapi/code'
import {Headers} from '@hapi/shot'
import fetch from 'node-fetch'
import {v4 as uuidv4} from 'uuid'
import {init} from '../server'
import Side from '../../shared/side'
import Id from '../../shared/id'
import Order from '../../shared/order'
import Trade from '../../shared/trade'
import Orderbook from '../../shared/orderbook'
import _ from 'lodash'

const signInUrl = 'https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=AIzaSyBKXaj8-EsH-R9P6ITpJnIIsMgzY4am3to'

const lab = Lab.script()
const {afterEach, beforeEach, before, describe, it} = lab
export {lab}

describe('Server', () => {
    let server: Hapi.Server
    let instrument: string
    let user1: Headers
    let user2: Headers

    function postOrder(payload: any, headers: Headers) {
        return server.inject({
            method: 'POST',
            url: '/api/v1/orders',
            payload: payload,
            headers: headers
        })
    }

    function getUserOrders(headers: Headers) {
        return server.inject({
            method: 'GET',
            url: '/api/v1/user/orders',
            headers: headers
        })
    }

    function getOrder(id: Id, headers: Headers) {
        return server.inject({
            method: 'GET',
            url: `/api/v1/orders/${id.id}`,
            headers: headers
        })
    }

    function deleteOrder(id: Id, headers: Headers) {
        return server.inject({
            method: 'DELETE',
            url: `/api/v1/orders/${id.id}`,
            headers: headers
        })
    }

    function getTrade(id: string, headers: Headers) {
        return server.inject({
            method: 'GET',
            url: `/api/v1/trades/${id}`,
            headers: headers
        })
    }

    async function createUser() {
        const r = await fetch(signInUrl, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({returnSecureToken: true})
        })
        const token = (await r.json()).idToken
        return {'Authorization': `Bearer ${token}`}
    }

    before(async () => {
        user1 = await createUser()
        user2 = await createUser()
    })

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
                url: '/api/v1/',
                headers: user1
            })

            expect(res.statusCode).to.equal(200)
        })

        it('responds with 401', async () => {
            const res = await server.inject({
                method: 'GET',
                url: '/api/v1/',
                headers: {}
            })

            expect(res.statusCode).to.equal(401)
        })
    })

    describe('POST orders', () => {
        it('responds with 400 on invalid instrument', async () => {
            const res = await postOrder({instrument: '', side: Side.BUY, volume: 1000, price: 10}, user1)
            expect(res.statusCode).to.equal(400)
        })

        it('responds with 400 on invalid side', async () => {
            const res = await postOrder({instrument: '__test', side: '', volume: 1000, price: 10}, user1)
            expect(res.statusCode).to.equal(400)
        })

        it('responds with 400 on invalid volume', async () => {
            const res = await postOrder({instrument: '__test', side: Side.BUY, volume: 0, price: 10}, user1)
            expect(res.statusCode).to.equal(400)
        })

        it('responds with 400 on invalid price', async () => {
            const res = await postOrder({instrument: '__test', side: Side.BUY, volume: 1000, price: 0}, user1)
            expect(res.statusCode).to.equal(400)
        })

        it('creates basic order', async () => {
            const created = await postOrder({instrument: instrument, side: Side.BUY, volume: 1000, price: 10}, user1)
            expect(created.statusCode).to.equal(201)
            const id = created.result as Id

            const res = await getOrder(id, user1)
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
            const created1 = await postOrder({instrument: instrument, side: Side.BUY, volume: 1000, price: 10}, user1)
            expect(created1.statusCode).to.equal(201)

            const created2 = await postOrder({instrument: instrument, side: Side.SELL, volume: 1000, price: 10}, user2)
            expect(created2.statusCode).to.equal(201)

            const arr: [Id, Headers][] = [[created1.result as Id, user1], [created2.result as Id, user2]]
            for (const [id, user] of arr) {
                const order = (await getOrder(id, user)).result as Order
                expect(order.active_volume).to.equal(0)
                expect(order.filled_volume).to.equal(1000)
                expect(order.related_trades).to.have.length(1)

                const trade = (await getTrade(order.related_trades[0], user)).result as Trade
                expect(trade.volume).to.equal(1000)
                expect(trade.price).to.equal(10)
            }
        })

        it('does not match user with own orders', async () => {
            const created1 = await postOrder({instrument: instrument, side: Side.BUY, volume: 1000, price: 10}, user1)
            expect(created1.statusCode).to.equal(201)

            const created2 = await postOrder({instrument: instrument, side: Side.SELL, volume: 1000, price: 10}, user1)
            expect(created2.statusCode).to.equal(201)

            const order1 = (await getOrder(created1.result as Id, user1)).result as Order
            expect(order1.active_volume).to.equal(1000)

            const order2 = (await getOrder(created2.result as Id, user1)).result as Order
            expect(order2.active_volume).to.equal(1000)
        })
    })

    describe('GET user orders', () => {
        it('responds with the user\'s orders', async() => {
            const simple = (os: Order[]) => os.map(o => _.omit(o, ['id', 'create_time']))
            const u1 = await createUser()
            const u2 = await createUser()
            await postOrder({instrument: instrument, side: Side.BUY, volume: 1000, price: 10}, u1)
            await postOrder({instrument: instrument, side: Side.BUY, volume: 500, price: 11}, u1)
            await postOrder({instrument: instrument, side: Side.BUY, volume: 650, price: 9}, u2)

            const orders1 = await getUserOrders(u1)
            expect(simple(orders1.result as Order[])).to.equal([
                {
                    active_volume: 1000,
                    filled_volume: 0,
                    instrument: instrument,
                    price: 10,
                    related_trades: [],
                    side: Side.BUY,
                    total_volume: 1000
                },
                {
                    active_volume: 500,
                    filled_volume: 0,
                    instrument: instrument,
                    price: 11,
                    related_trades: [],
                    side: Side.BUY,
                    total_volume: 500
                }
            ])

            const orders2 = await getUserOrders(u2)
            expect(simple(orders2.result as Order[])).to.equal([
                {
                    active_volume: 650,
                    filled_volume: 0,
                    instrument: instrument,
                    price: 9,
                    related_trades: [],
                    side: Side.BUY,
                    total_volume: 650
                }
            ])
        })
    })

    describe('GET orders', () => {
        it('responds with 404 on missing order', async () => {
            const res = await getOrder({id: 'non-existent'}, user1)
            expect(res.statusCode).to.equal(404)
        })

        it('responds with 401 on incorrect user', async () => {
            const created = await postOrder({instrument: instrument, side: Side.BUY, volume: 1000, price: 10}, user1)
            const res = await getOrder(created.result as Id, user2)
            expect(res.statusCode).to.equal(401)
        })
    })

    describe('DELETE orders', () => {
        it('responds with 404 on missing order', async () => {
            const res = await deleteOrder({id: 'non-existent'}, user1)
            expect(res.statusCode).to.equal(404)
        })

        it('responds with 401 on incorrect user', async () => {
            const created = await postOrder({instrument: instrument, side: Side.BUY, volume: 1000, price: 10}, user1)
            const deleted = await deleteOrder(created.result as Id, user2)
            expect(deleted.statusCode).to.equal(401)
        })

        it('sets active volume to 0', async () => {
            const created = await postOrder({instrument: instrument, side: Side.BUY, volume: 1000, price: 10}, user1)
            const deleted = await deleteOrder(created.result as Id, user1)
            expect(deleted.statusCode).to.equal(200)

            const order = (await getOrder(created.result as Id, user1)).result as Order
            expect(order.active_volume).to.equal(0)
        })
    })

    describe('GET trades', () => {
        it('responds with 404 on missing trade', async () => {
            const res = await getTrade('non-existent', user1)
            expect(res.statusCode).to.equal(404)
        })
    })

    describe('GET orderbooks', () => {
        it('responds with orderbook', async () => {
            await postOrder({instrument: instrument, side: Side.BUY, volume: 2000, price: 10}, user1)
            await postOrder({instrument: instrument, side: Side.BUY, volume: 1000, price: 11}, user1)
            await postOrder({instrument: instrument, side: Side.SELL, volume: 500, price: 11}, user2)
            await postOrder({instrument: instrument, side: Side.SELL, volume: 3000, price: 13}, user2)

            const res = await server.inject({
                method: 'GET',
                url: `/api/v1/orderbooks/${instrument}`,
                headers: user1
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
