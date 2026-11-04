import test from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { seatInput, readBody, HttpError } from '../lib/http.js'
import { transaction } from '../lib/transaction.js'
import { createBookingHandlers } from '../lib/booking-handlers.js'
import { verifySignature } from '../lib/payments.js'

const request = body => new Request('http://localhost/api/book', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

test('seat identifiers are canonical and aliases cannot disagree', () => {
  assert.deepEqual(seatInput({ flight_id: '1', seatId: 'A1' }), { flightId: 1, seat: 'A1' })
  for (const body of [{ flightId: 1, seatId: 4 }, { flightId: 1, seat: '1A' }, { flightId: 1, seat: 'A16' },
    { flightId: 1, seat: 'A1', seatId: 'B1' }, { flightId: 1, flight_id: 2, seat: 'A1' }]) assert.throws(() => seatInput(body), HttpError)
})

test('malformed JSON, nonobjects, and cross-origin writes rejected', async () => {
  await assert.rejects(readBody(new Request('http://localhost', { method: 'POST', body: '{' })), { status: 400 })
  await assert.rejects(readBody(request([])), { status: 400 })
  await assert.rejects(readBody(new Request('http://localhost', { method: 'POST', headers: { origin: 'https://evil.example' }, body: '{}' })), { status: 403 })
})

test('transaction rolls back and releases on failure, including commit failure', async () => {
  for (const failCommit of [false, true]) {
    const calls = []
    const c = { beginTransaction: async () => calls.push('begin'), commit: async () => { calls.push('commit'); if (failCommit) throw new Error('commit failed') },
      rollback: async () => calls.push('rollback'), release: () => calls.push('release') }
    await assert.rejects(transaction({ getConnection: async () => c }, async () => { if (!failCommit) throw new Error('work failed') }))
    assert.deepEqual(calls, failCommit ? ['begin','commit','rollback','release'] : ['begin','rollback','release'])
  }
})

test('payment signature is bound to server order and payment', () => {
  const signature = createHmac('sha256','secret').update('order_1|pay_1').digest('hex')
  verifySignature('order_1','pay_1',signature,'secret')
  assert.throws(() => verifySignature('order_2','pay_1',signature,'secret'), { status: 400 })
  assert.throws(() => verifySignature('order_1','pay_1','bad','secret'), { status: 400 })
})

test('a connection is destroyed rather than reused if rollback fails', async () => {
  const calls=[]
  await assert.rejects(transaction({getConnection:async()=>({
    beginTransaction:async()=>{},rollback:async()=>{throw new Error('connection lost')},
    release:()=>calls.push('release'),destroy:()=>calls.push('destroy')
  })},async()=>{throw new Error('original failure')}),/original failure/)
  assert.deepEqual(calls,['destroy'])
})

test('both finalization endpoints share one handler and use authenticated identity', async () => {
  const calls = []
  const handlers = createBookingHandlers({ auth: { requireUser: async () => ({ id: 7 }) },
    paymentFlow: { callback: async id => { calls.push(['callback',id]); return { pnr: 123456 } } } })
  assert.equal(handlers.book, handlers.confirm)
  assert.equal((await handlers.book(request({ userId: 999, user_id: 999 }))).status, 200)
  assert.deepEqual(calls, [['callback',7]])
})

test('unauthenticated writes and invalid payment never finalize', async () => {
  let writes = 0
  const reservations = { lock: async () => writes++, inspect: async () => ({}), finalize: async () => writes++ }
  const handlers = createBookingHandlers({ auth: { requireUser: async () => { throw new HttpError(401,'Sign in') } }, reservations })
  assert.equal((await handlers.lock(request({ userId: 1 }))).status, 401)
  const authenticated = createBookingHandlers({ auth: { requireUser: async () => ({ id: 1 }) }, reservations,
    paymentFlow: { callback: async () => { throw new HttpError(400,'Bad signature') } } })
  assert.equal((await authenticated.confirm(request({}))).status, 400)
  assert.equal(writes, 0)
})

test('JSON bodies are bounded before parsing',async()=>{
 await assert.rejects(readBody(new Request('http://localhost',{method:'POST',body:JSON.stringify({value:'x'.repeat(32768)})})),{status:413})
})
