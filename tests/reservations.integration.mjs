import { before, after, beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import mysql from 'mysql2/promise'
import { createReservations } from '../lib/reservations.js'
import { createAuth } from '../lib/auth.js'
import { createBookingHandlers } from '../lib/booking-handlers.js'
import { createPaymentFlow } from '../lib/payment-flow.js'
import { createPaymentStore } from '../lib/payment-store.js'
import { paymentFixture } from './helpers/payment-fixture.mjs'
import { migrate } from '../scripts/reservations-db.mjs'

// This suite NEVER connects a pool to DB_NAME. It creates and drops only its own
// random, explicitly prefixed database on the local MariaDB server.
const database = 'firstfly_test_' + randomUUID().replaceAll('-', '')
let admin, pool, reservations
const settings = { host: process.env.DB_HOST, port: process.env.DB_PORT,
  user: process.env.DB_USER, password: process.env.DB_PASSWORD }

before(async () => {
  if (!['localhost','127.0.0.1','::1'].includes(settings.host)) throw new Error('Integration suite requires a local DB_HOST')
  admin = await mysql.createConnection(settings)
  await admin.query(`CREATE DATABASE \`${database}\``)
  pool = mysql.createPool({ ...settings, database, connectionLimit: 12 })
  for (const sql of [
    'CREATE TABLE users (id INT PRIMARY KEY, name VARCHAR(100), email VARCHAR(100) UNIQUE, password VARCHAR(255)) ENGINE=InnoDB',
    'CREATE TABLE flights (flight_code INT PRIMARY KEY,price INT,current_location VARCHAR(50),desired_location VARCHAR(50)) ENGINE=InnoDB',
    `CREATE TABLE seats (id INT PRIMARY KEY,flight_id INT,seat_number VARCHAR(10),status ENUM('available','locked','booked') DEFAULT 'available',locked_by INT,lock_expiry DATETIME,
      UNIQUE KEY unique_flight_seat(flight_id,seat_number),FOREIGN KEY(flight_id) REFERENCES flights(flight_code)) ENGINE=InnoDB`,
    `CREATE TABLE passengers (id INT PRIMARY KEY AUTO_INCREMENT,name VARCHAR(50),age INT,gender VARCHAR(10),flight_id INT,price INT,travel_class VARCHAR(20),seat VARCHAR(10),pnr INT,payment_id VARCHAR(255),payment_status VARCHAR(50),user_id INT,status ENUM('booked','cancelled') DEFAULT 'booked') ENGINE=InnoDB`,
    'CREATE TABLE bookings (id INT PRIMARY KEY,user_id INT,flight_id INT,seat_id INT,status VARCHAR(50)) ENGINE=InnoDB'
  ]) await pool.query(sql)
  await pool.query("INSERT INTO passengers (flight_id,seat) VALUES (99,'4A'),(99,'4A')")
  await migrate(pool)
  await migrate(pool)
  assert.equal((await pool.query('SELECT COUNT(*) n FROM passengers'))[0][0].n, 2, 'migration must preserve inconsistent legacy records')
  reservations = createReservations(pool)
})

after(async () => {
  if (pool) await pool.end()
  if (admin) {
    if (!/^firstfly_test_[a-f0-9]{32}$/.test(database) || database === process.env.DB_NAME) throw new Error('Unsafe test database cleanup target')
    await admin.query(`DROP DATABASE IF EXISTS \`${database}\``)
    await admin.end()
  }
})

beforeEach(async () => {
  await pool.query('DROP TRIGGER IF EXISTS fail_seat_update')
  await pool.query('DROP TRIGGER IF EXISTS fail_order_update')
  for (const table of ['payment_webhook_events','payment_records','reservation_attempts','auth_sessions','passengers','bookings','seats','users','flights']) await pool.query(`DELETE FROM ${table}`)
  await pool.query("INSERT INTO users (id,name,email) VALUES (1,'One','one@example.test'),(2,'Two','two@example.test')")
  await pool.query('INSERT INTO flights (flight_code,price) VALUES (1,5000),(2,6000)')
  await pool.query("INSERT INTO seats (id,flight_id,seat_number) VALUES (1,1,'A4'),(2,1,'B4'),(3,2,'A4'),(4,1,'A1')")
})

const body = (extra = {}) => ({ flightId: 1, seatNumber: 'A4', attemptId: randomUUID(), travelClass: 'Economy', name: 'Test Passenger', age: 25, gender: 'Female', ...extra })
const rows = async sql => (await pool.query(sql))[0]
async function payable(b, user = 1) {
  const lock = await reservations.lock(user,b)
  const id = 'order_' + b.attemptId.replaceAll('-','')
  await reservations.attachOrder(user,b,{ id, amount: lock.price * 100, currency: 'INR' })
  return { id: 'pay_' + b.attemptId.replaceAll('-',''), order_id: id, amount: lock.price * 100, currency: 'INR', status: 'captured', captured: true, amount_refunded: 0 }
}

test('simultaneous users compete for one seat: exactly one winner', async () => {
  const results = await Promise.allSettled(Array.from({ length: 10 }, (_,i) => reservations.lock(i % 2 + 1, body())))
  assert.equal(results.filter(r => r.status === 'fulfilled').length,1)
  assert.equal((await rows('SELECT * FROM reservation_attempts')).length,1)
})

test('same attempt retries are idempotent and do not extend the lock', async () => {
  const b = body()
  const results = await Promise.all([reservations.lock(1,b),reservations.lock(1,b)])
  assert.deepEqual(results[0],results[1])
  assert.equal((await rows('SELECT * FROM reservation_attempts')).length,1)
})

test('expired locks may be replaced; stale release cannot free new owner', async () => {
  const old = body(); await reservations.lock(1,old)
  await pool.query('UPDATE seats SET lock_expiry=NOW()-INTERVAL 1 SECOND WHERE id=1')
  const fresh = body(); await reservations.lock(2,fresh)
  assert.equal((await reservations.release(1,old)).released,false)
  assert.equal((await rows('SELECT locked_by FROM seats WHERE id=1'))[0].locked_by,2)
})

test('booked seat with stale expiry cannot be acquired or reopened by listing', async () => {
  await pool.query("UPDATE seats SET status='booked',lock_expiry=NOW()-INTERVAL 1 DAY WHERE id=1")
  await assert.rejects(reservations.lock(1,body()),{ status: 409 })
  assert.equal((await reservations.list(1)).find(s=>s.id===1).status,'booked')
  assert.equal((await rows('SELECT status FROM seats WHERE id=1'))[0].status,'booked')
})

test('listing exposes expired locks as available without writing or leaking owners', async () => {
  await reservations.lock(1,body())
  await pool.query('UPDATE seats SET lock_expiry=NOW()-INTERVAL 1 SECOND WHERE id=1')
  const s = (await reservations.list(1)).find(s=>s.id===1)
  assert.equal(s.status,'available'); assert.equal(s.locked_by,undefined); assert.equal(s.lock_attempt_id,undefined)
  assert.equal((await rows('SELECT status FROM seats WHERE id=1'))[0].status,'locked')
})

test('release requires matching user, flight, seat and attempt; is idempotent', async () => {
  const a = body(), b = body({ flightId: 2 })
  await reservations.lock(1,a); await reservations.lock(1,b)
  await assert.rejects(reservations.release(2,a),{ status: 409 })
  await assert.rejects(reservations.release(1,{ ...a, flightId: 2 }),{ status: 409 })
  await assert.rejects(reservations.release(1,{ ...a, attemptId: randomUUID() }),{ status: 409 })
  assert.equal((await reservations.release(1,a)).released,true)
  assert.equal((await reservations.release(1,a)).released,false)
  assert.equal((await rows('SELECT status FROM seats WHERE id=3'))[0].status,'locked')
})

test('finalization inserts once, books the seat and clears all lock metadata', async () => {
  const b = body(), payment = await payable(b)
  const results = await Promise.all([reservations.finalize(1,b,payment),reservations.finalize(1,b,payment)])
  assert.deepEqual(results[0],results[1])
  assert.equal((await rows('SELECT * FROM passengers')).length,1)
  const s = (await rows('SELECT * FROM seats WHERE id=1'))[0]
  assert.equal(s.status,'booked'); assert.equal(s.locked_by,null); assert.equal(s.lock_expiry,null); assert.equal(s.lock_attempt_id,null)
  await assert.rejects(reservations.release(1,b),{ status: 409 })
})

test('booking rejects expired, released, wrong-owner and missing reservations', async () => {
  const b = body(), payment = await payable(b)
  await assert.rejects(reservations.finalize(2,b,payment),{ status: 409 })
  await assert.rejects(reservations.finalize(1,{ ...b, attemptId: randomUUID() },payment),{ status: 409 })
  await pool.query('UPDATE seats SET lock_expiry=NOW()-INTERVAL 1 SECOND WHERE id=1')
  await assert.rejects(reservations.finalize(1,b,payment),{ status: 409 })
  await reservations.release(1,b)
  await assert.rejects(reservations.finalize(1,b,payment),{ status: 409 })
  assert.equal((await rows('SELECT * FROM passengers')).length,0)
})

test('payment amount, currency, capture state and order are all checked', async () => {
  const b = body(), payment = await payable(b)
  for (const patch of [{ amount: 1 },{ currency: 'USD' },{ status: 'authorized' },{ order_id: 'order_wrong' }]) {
    await assert.rejects(reservations.finalize(1,b,{ ...payment,...patch }),{ status: 409 })
  }
  assert.equal((await rows('SELECT * FROM passengers')).length,0)
})

test('client user, fare and class cannot override stored reservation', async () => {
  const b = body(), payment = await payable(b)
  await reservations.finalize(1,{ ...b, price: 1, user_id: 2, travelClass: 'Business' },payment)
  const p = (await rows('SELECT * FROM passengers'))[0]
  assert.equal(p.user_id,1); assert.equal(p.price,5000); assert.equal(p.travel_class,'Economy')
})

test('transaction rolls passenger insert, payment claim and PNR back on seat failure', async () => {
  const b = body(), payment = await payable(b)
  await pool.query("CREATE TRIGGER fail_seat_update BEFORE UPDATE ON seats FOR EACH ROW BEGIN IF NEW.status='booked' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Injected failure'; END IF; END")
  await assert.rejects(reservations.finalize(1,b,payment))
  assert.equal((await rows('SELECT * FROM passengers')).length,0)
  const a = (await rows('SELECT * FROM reservation_attempts'))[0]
  assert.equal(a.payment_id,null); assert.equal(a.pnr,null); assert.equal(a.passenger_id,null); assert.equal(a.status,'locked')
  assert.equal((await rows('SELECT status FROM seats WHERE id=1'))[0].status,'locked')
  await pool.query('DROP TRIGGER fail_seat_update')
  await reservations.finalize(1,b,payment)
})

test('same payment cannot create a second booking on another seat', async () => {
  const a=body(), b=body({ seatNumber: 'B4' })
  const pa=await payable(a), pb=await payable(b)
  await reservations.finalize(1,a,pa)
  await assert.rejects(reservations.finalize(1,b,{ ...pb,id:pa.id }),{ status: 409 })
  assert.equal((await rows('SELECT * FROM passengers')).length,1)
})

test('cancellation preserves history, releases inventory once and permits rebooking', async () => {
  const a=body(), pa=await payable(a), booking=await reservations.finalize(1,a,pa)
  await assert.rejects(reservations.cancel(2,{ bookingId: booking.bookingId }),{ status: 404 })
  await assert.rejects(reservations.cancel(1,{ bookingId: booking.bookingId,seat:'B4' }),{ status: 400 })
  await reservations.cancel(1,{ bookingId: booking.bookingId })
  assert.equal((await rows('SELECT status FROM passengers'))[0].status,'cancelled')
  const b=body(), pb=await payable(b,2); await reservations.finalize(2,b,pb)
  await reservations.cancel(1,{ bookingId: booking.bookingId })
  assert.equal((await rows('SELECT status FROM seats WHERE id=1'))[0].status,'booked')
  assert.equal((await rows('SELECT * FROM passengers')).length,2)
  await assert.rejects(reservations.finalize(1,a,pa),{ status: 409 })
})

test('cancellation rolls history and attempt status back when inventory update fails', async () => {
  const b=body(), p=await payable(b), booking=await reservations.finalize(1,b,p)
  await pool.query("CREATE TRIGGER fail_seat_update BEFORE UPDATE ON seats FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Injected cancellation failure'")
  await assert.rejects(reservations.cancel(1,{ bookingId: booking.bookingId }))
  assert.equal((await rows('SELECT status FROM passengers'))[0].status,'booked')
  assert.equal((await rows('SELECT status FROM reservation_attempts'))[0].status,'confirmed')
  assert.equal((await rows('SELECT status FROM seats WHERE id=1'))[0].status,'booked')
})

test('legacy active records protect inventory even with row-first labels', async () => {
  await pool.query("INSERT INTO passengers (flight_id,seat,user_id,pnr) VALUES (1,'4A',1,123456)")
  await assert.rejects(reservations.lock(2,body()),{ status: 409 })
  assert.equal((await reservations.list(1)).find(s=>s.id===1).status,'booked')
  assert.equal((await rows('SELECT status FROM seats WHERE id=1'))[0].status,'available')
})

test('legacy duplicate bookings are quarantined, never deleted or auto-cancelled', async () => {
  await pool.query("INSERT INTO passengers (flight_id,seat,user_id,pnr) VALUES (1,'A4',1,123456),(1,'4A',2,234567)")
  await assert.rejects(reservations.cancel(1,{ pnr:123456 }),{ status: 409 })
  await assert.rejects(reservations.lock(1,body()),{ status: 409 })
  assert.equal((await rows("SELECT * FROM passengers WHERE status='booked'")).length,2)
})

test('unknown legacy seat blocks flight and old bookings table also protects inventory', async () => {
  await pool.query('INSERT INTO passengers (flight_id,seat) VALUES (1,NULL)')
  await assert.rejects(reservations.lock(1,body({ seatNumber: 'B4' })),{ status: 409 })
  await pool.query('DELETE FROM passengers')
  await pool.query("INSERT INTO bookings VALUES (1,1,1,1,'confirmed')")
  await assert.rejects(reservations.lock(1,body()),{ status: 409 })
})

test('malformed seat, class and passenger inputs do not create bookings', async () => {
  await assert.rejects(reservations.lock(1,body({ seatNumber: 'A1' })),{ status: 400 })
  await assert.rejects(reservations.lock(1,body({ attemptId: 'bad' })),{ status: 400 })
  const b=body(), p=await payable(b)
  for (const patch of [{ name: '' },{ age: -1 },{ age: 121 },{ gender: '' }]) await assert.rejects(reservations.finalize(1,{ ...b,...patch },p),{ status: 400 })
})

test('database sessions cannot be forged, expire and are revoked on logout', async () => {
  const auth=createAuth(pool)
  const response=await auth.login({ id:1,name:'One',email:'one@example.test' })
  const cookie=response.headers.get('set-cookie')
  assert.match(cookie,/HttpOnly/)
  const req=new Request('http://localhost',{ headers:{ cookie } })
  assert.equal((await auth.requireUser(req)).id,1)
  await assert.rejects(auth.requireUser(new Request('http://localhost',{ headers:{ cookie:'firstfly_session='+'a'.repeat(64) } })),{ status:401 })
  await auth.logout(req)
  await assert.rejects(auth.requireUser(req),{ status:401 })
  const second=await auth.login({ id:1 })
  await pool.query('UPDATE auth_sessions SET expires_at=NOW()-INTERVAL 1 SECOND')
  await assert.rejects(auth.requireUser(new Request('http://localhost',{ headers:{cookie:second.headers.get('set-cookie')} })),{ status:401 })
})

test('release racing confirmation cannot leave a booked passenger on available inventory', async () => {
  const b=body(), p=await payable(b)
  await Promise.allSettled([reservations.finalize(1,b,p),reservations.release(1,b)])
  const passengers=await rows('SELECT * FROM passengers')
  const seat=(await rows('SELECT * FROM seats WHERE id=1'))[0]
  if (passengers.length) assert.equal(seat.status,'booked')
  else assert.equal(seat.status,'available')
})

test('parallel cross-seat payment reuse is blocked by the unique payment ledger', async () => {
  const a=body(), b=body({ seatNumber:'B4' })
  const pa=await payable(a), pb=await payable(b)
  const results=await Promise.allSettled([reservations.finalize(1,a,pa),reservations.finalize(1,b,{...pb,id:pa.id})])
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1)
  assert.equal((await rows('SELECT * FROM passengers')).length,1)
})

test('legacy single booking can be cancelled by owner without deleting history', async () => {
  await pool.query("INSERT INTO passengers (flight_id,seat,user_id,pnr) VALUES (1,'4A',1,123456)")
  await reservations.cancel(1,{pnr:123456})
  assert.equal((await rows('SELECT status FROM passengers'))[0].status,'cancelled')
  await reservations.lock(2,body())
})

test('HTTP workflow uses one booking path; provider calls never hold a transaction', async () => {
  let connections=0
  const observedPool={
    execute: (...args)=>pool.execute(...args),
    async getConnection() {
      const c=await pool.getConnection(); connections++
      return {
        execute: (...args)=>c.execute(...args), beginTransaction: ()=>c.beginTransaction(),
        commit: ()=>c.commit(),rollback: ()=>c.rollback(),release: ()=>{ connections--;c.release() },destroy: ()=>{ connections--;c.destroy() }
      }
    }
  }
  const auth=createAuth(pool)
  const session=await auth.login({id:1})
  const cookie=session.headers.get('set-cookie')
  const b=body()
  const fixture=paymentFixture(()=>assert.equal(connections,0))
  const service=createReservations(observedPool)
  const flow=createPaymentFlow({reservations:service,store:createPaymentStore(pool),gateway:fixture.gateway})
  const handlers=createBookingHandlers({auth,reservations:service,paymentFlow:flow})
  const req=payload=>new Request('http://localhost/api/book',{method:'POST',headers:{cookie,'Content-Type':'application/json'},body:JSON.stringify(payload)})
  assert.equal((await handlers.lock(req({...b,userId:2}))).status,200)
  const orderResponse=await handlers.payment(req({...b,amount:1}))
  assert.equal(orderResponse.status,200)
  const order=await orderResponse.json()
  const proof=fixture.proof(fixture.pay(order.id))
  const confirmed=await handlers.confirm(req({...b,...proof}))
  assert.equal(confirmed.status,200)
  const again=await handlers.book(req({...b,...proof}))
  assert.deepEqual(await again.json(),await confirmed.json())
  const p=(await rows('SELECT * FROM passengers'))[0]
  assert.equal(p.user_id,1)
  assert.equal((await rows('SELECT * FROM passengers')).length,1)
  assert.equal((await handlers.cancel(req({bookingId:p.id,userId:2}))).status,200)
  assert.equal((await rows('SELECT status FROM passengers'))[0].status,'cancelled')
  assert.equal(connections,0)
})

async function paymentCase() {
  const b=body(),fixture=paymentFixture(),store=createPaymentStore(pool)
  const flow=createPaymentFlow({reservations,store,gateway:fixture.gateway})
  await reservations.lock(1,b)
  const order=await flow.order(1,b)
  return {b,fixture,store,flow,order}
}

test('concurrent order requests create only one persisted provider order',async()=>{
  const b=body(),fixture=paymentFixture(),store=createPaymentStore(pool)
  const flow=createPaymentFlow({reservations,store,gateway:fixture.gateway})
  await reservations.lock(1,b)
  const results=await Promise.all([flow.order(1,{...b,amount:1}),flow.order(1,{...b,amount:2})])
  assert.equal(fixture.creates,1)
  const a=await store.get(b.attemptId)
  assert.ok(a.order_id)
  assert.equal(a.price,5000)
  for(const r of results) if(r.id) assert.equal(r.id,a.order_id)
  assert.equal((await flow.order(1,b)).id,a.order_id)
})

test('callback invalid signature and provider mismatches never insert a booking',async()=>{
  const {b,fixture,flow,order}=await paymentCase()
  const p=fixture.pay(order.id),proof=fixture.proof(p)
  await assert.rejects(flow.callback(1,{...b,...proof,razorpay_signature:'0'.repeat(64)}),{status:400})
  for(const patch of [{amount:1},{currency:'USD'},{order_id:'order_wrong'},{captured:false}]) {
    fixture.payments.set(p.id,{...p,...patch})
    await assert.rejects(flow.callback(1,{...b,...proof}),{status:409})
  }
  assert.equal((await rows('SELECT * FROM passengers')).length,0)
})

test('pending and failed payments never finalize; later capture is reconciled',async()=>{
  const {b,fixture,flow,order}=await paymentCase()
  const p=fixture.pay(order.id,{status:'authorized',captured:false})
  assert.equal((await flow.callback(1,{...b,...fixture.proof(p)})).state,'pending')
  fixture.payments.set(p.id,{...p,status:'failed'})
  assert.equal((await flow.reconcileOwned(1,b)).state,'failed')
  assert.equal((await rows('SELECT * FROM passengers')).length,0)
  fixture.payments.set(p.id,{...p,status:'captured',captured:true})
  assert.equal((await flow.reconcileOwned(1,b)).state,'confirmed')
  assert.equal((await rows('SELECT * FROM passengers')).length,1)
})

test('callback and duplicate webhooks converge on exactly one booking',async()=>{
  const {b,fixture,flow,order}=await paymentCase()
  const p=fixture.pay(order.id),event=fixture.event(p)
  const results=await Promise.all([
    flow.callback(1,{...b,...fixture.proof(p)}),
    flow.webhook(event.raw,event.signature,'event-one'),
    flow.webhook(event.raw,event.signature,'event-two')
  ])
  assert.ok(results.every(r=>r.state==='confirmed'||r.duplicate))
  assert.equal((await rows('SELECT * FROM passengers')).length,1)
  assert.equal((await rows('SELECT * FROM payment_webhook_events')).length,1)
  assert.equal((await flow.webhook(event.raw,event.signature,'forged-header')).duplicate,true)
})

test('invalid webhook signature performs no database work',async()=>{
  const {fixture,flow,order}=await paymentCase()
  const event=fixture.event(fixture.pay(order.id))
  await assert.rejects(flow.webhook(event.raw,'0'.repeat(64),'event'),{status:400})
  assert.equal((await rows('SELECT * FROM payment_webhook_events')).length,0)
  assert.equal((await rows('SELECT * FROM payment_records')).length,0)
})

test('captured payment survives database finalization failure and webhook retry recovers',async()=>{
  const {fixture,flow,order}=await paymentCase()
  const p=fixture.pay(order.id),event=fixture.event(p)
  await pool.query("CREATE TRIGGER fail_seat_update BEFORE UPDATE ON seats FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Injected booking failure'")
  await assert.rejects(flow.webhook(event.raw,event.signature,'event'))
  assert.equal((await rows('SELECT * FROM passengers')).length,0)
  assert.equal((await rows('SELECT * FROM payment_records'))[0].provider_status,'captured')
  assert.equal((await rows('SELECT * FROM payment_webhook_events'))[0].state,'pending')
  await pool.query('DROP TRIGGER fail_seat_update')
  assert.equal((await flow.webhook(event.raw,event.signature,'event')).state,'confirmed')
  assert.equal((await rows('SELECT * FROM payment_records'))[0].resolution,'finalized')
})

test('captured payment after expiry goes to review without taking another users seat',async()=>{
  const {b,fixture,flow,order}=await paymentCase()
  await pool.query('UPDATE seats SET lock_expiry=NOW()-INTERVAL 1 SECOND WHERE id=1')
  const replacement=body();await reservations.lock(2,replacement)
  const p=fixture.pay(order.id)
  assert.equal((await flow.callback(1,{...b,...fixture.proof(p)})).state,'review')
  assert.equal((await rows('SELECT * FROM passengers')).length,0)
  assert.equal((await rows('SELECT locked_by FROM seats WHERE id=1'))[0].locked_by,2)
  assert.equal((await rows('SELECT * FROM payment_records'))[0].resolution,'review')
})

test('payment after explicit reservation release is retained for review',async()=>{
  const {b,fixture,flow,order}=await paymentCase()
  await reservations.release(1,b)
  fixture.pay(order.id)
  assert.equal((await flow.reconcileOwned(1,b)).state,'review')
  assert.equal((await rows('SELECT * FROM passengers')).length,0)
})

test('order accepted before database failure is recovered without another order',async()=>{
  const b=body(),fixture=paymentFixture(),store=createPaymentStore(pool)
  const flow=createPaymentFlow({reservations,store,gateway:fixture.gateway})
  await reservations.lock(1,b)
  await pool.query("CREATE TRIGGER fail_order_update BEFORE UPDATE ON reservation_attempts FOR EACH ROW BEGIN IF NEW.order_id IS NOT NULL THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Injected order failure'; END IF; END")
  await assert.rejects(flow.order(1,b))
  assert.equal(fixture.creates,1)
  await pool.query('DROP TRIGGER fail_order_update')
  const order=await flow.order(1,b)
  assert.ok(order.id);assert.equal(fixture.creates,1)
  assert.equal((await store.get(b.attemptId)).order_id,order.id)
})

test('browser interruption is recoverable from webhook using stored passenger details',async()=>{
  const {fixture,flow,order}=await paymentCase()
  const event=fixture.event(fixture.pay(order.id))
  assert.equal((await flow.webhook(event.raw,event.signature,'event')).state,'confirmed')
  assert.equal((await rows('SELECT name FROM passengers'))[0].name,'Test Passenger')
})

test('replayed callback remains idempotent even when provider is temporarily unavailable',async()=>{
  const {b,fixture,flow,order}=await paymentCase()
  const p=fixture.pay(order.id),proof=fixture.proof(p)
  const first=await flow.callback(1,{...b,...proof})
  fixture.sdk.payments.fetch=async()=>{throw new Error('offline')}
  const again=await flow.callback(1,{...b,...proof,name:'Tampered'})
  assert.deepEqual(again,first)
  assert.equal((await rows('SELECT * FROM passengers')).length,1)
})

test('refund or extra capture creates review record without another booking',async()=>{
  const {b,fixture,flow,order}=await paymentCase()
  const p=fixture.pay(order.id)
  await flow.callback(1,{...b,...fixture.proof(p)})
  const extra=fixture.pay(order.id),event=fixture.event(extra)
  assert.equal((await flow.webhook(event.raw,event.signature,'extra')).state,'review')
  fixture.payments.set(p.id,{...p,amount_refunded:100})
  assert.equal((await flow.reconcileOwned(1,b)).state,'review')
  assert.equal((await flow.callback(1,{...b,...fixture.proof(p)})).state,'review')
  assert.equal((await rows('SELECT * FROM passengers')).length,1)
})

test('payment reconciliation requires the authenticated owner',async()=>{
  const {b,flow}=await paymentCase()
  await assert.rejects(flow.reconcileOwned(2,{...b,userId:1}),{status:404})
})


test('resume checkout reconciles authorized or captured payment instead of issuing checkout',async()=>{
  const {b,fixture,flow,order}=await paymentCase()
  const p=fixture.pay(order.id,{status:'authorized',captured:false})
  assert.equal((await flow.order(1,b)).state,'pending')
  fixture.payments.set(p.id,{...p,status:'captured',captured:true})
  assert.equal((await flow.order(1,b)).state,'confirmed')
  assert.equal(fixture.creates,1)
})

test('webhook re-fetches current capture rather than trusting older authorized payload',async()=>{
  const {fixture,flow,order}=await paymentCase()
  const p=fixture.pay(order.id,{status:'authorized',captured:false}),event=fixture.event(p,'payment.authorized')
  fixture.payments.set(p.id,{...p,status:'captured',captured:true})
  assert.equal((await flow.webhook(event.raw,event.signature,'old-event')).state,'confirmed')
  assert.equal((await rows('SELECT * FROM payment_records'))[0].provider_status,'captured')
})


test('official refund.processed webhook records review without deleting the booking',async()=>{
  const {b,fixture,flow,order}=await paymentCase()
  const p=fixture.pay(order.id)
  await flow.callback(1,{...b,...fixture.proof(p)})
  const refunded={...p,status:'refunded',amount_refunded:p.amount}
  fixture.payments.set(p.id,refunded)
  const event=fixture.event(refunded,'refund.processed')
  assert.equal((await flow.webhook(event.raw,event.signature,'refund-event')).state,'review')
  assert.equal((await rows('SELECT * FROM payment_records'))[0].review_code,'refund_detected')
  assert.equal((await rows('SELECT * FROM passengers')).length,1)
})

test('authentication rate limits are shared, bounded and reset after expiry', async () => {
  const { throttle } = await import('../lib/credentials.js')
  await pool.query('DELETE FROM auth_rate_limits')
  for(let i=0;i<15;i++) await throttle(pool,'one@example.test')
  await assert.rejects(throttle(pool,'ONE@example.test'),{status:429})
  await pool.query('UPDATE auth_rate_limits SET expires_at=NOW()-INTERVAL 1 SECOND')
  await throttle(pool,'one@example.test')
})

test('new login rotates and revokes the presented previous session', async () => {
  const auth=createAuth(pool)
  const old=await auth.login({id:1})
  const req=new Request('http://localhost',{headers:{cookie:old.headers.get('set-cookie')}})
  const next=await auth.login({id:1},req)
  await assert.rejects(auth.requireUser(req),{status:401})
  assert.equal((await auth.requireUser(new Request('http://localhost',{headers:{cookie:next.headers.get('set-cookie')}}))).id,1)
})

test('credential login validates bcrypt, hides password, and returns generic failures', async () => {
  const { createCredentialHandler } = await import('../lib/credentials.js')
  const bcrypt = (await import('bcryptjs')).default
  await pool.query('DELETE FROM auth_rate_limits')
  await pool.execute('UPDATE users SET password=? WHERE id=1',[await bcrypt.hash('correct-password',10)])
  const handler=createCredentialHandler(pool)
  const request=(email,password)=>new Request('http://localhost/api/auth/login',{method:'POST',body:JSON.stringify({email,password,userId:2})})
  const bad=await handler(request('one@example.test','incorrect'))
  const absent=await handler(request('missing@example.test','incorrect'))
  assert.equal(bad.status,401);assert.deepEqual(await bad.json(),await absent.json())
  const response=await handler(request('one@example.test','correct-password'))
  assert.equal(response.status,200)
  const body=await response.json()
  assert.equal(body.user.id,1);assert.equal(body.user.password,undefined)
  assert.equal((await createAuth(pool).requireUser(new Request('http://localhost',{headers:{cookie:response.headers.get('set-cookie')}}))).id,1)
})
