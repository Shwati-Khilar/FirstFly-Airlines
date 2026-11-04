import { createHash } from 'node:crypto'
import { HttpError } from './http.js'
import { validateOrder, validatePayment, providerId } from './payments.js'

const input = a => ({ flightId: a.flight_id, seatNumber: a.seat_number, attemptId: a.id,
  name: a.passenger_name, age: a.passenger_age, gender: a.passenger_gender })
const confirmed = a => ({ success: true, state: 'confirmed', pnr: a.pnr, bookingId: a.passenger_id,
  price: a.price, attemptId: a.id, name: a.passenger_name, travelClass: a.travel_class, seatNumber: a.seat_number })
const review = (id, reason) => ({ success: false, state: 'review', paymentId: id, reason,
  message: 'Payment requires support review. Do not pay again.' })

export function createPaymentFlow({ reservations, store, gateway }) {
  async function associate(a, order) {
    validateOrder(a, order)
    await store.attachOrder(a.id, order)
    return store.get(a.id)
  }
  async function recoverOrder(a) {
    if (a.order_id) return a
    if (a.order_state === 'none') return a
    const orders = await gateway.findOrders(a.id)
    if (orders.length > 1) throw new HttpError(409, 'Multiple provider orders require manual review')
    return orders.length ? associate(a, orders[0]) : a
  }
  async function processPayment(a, p, requestedId) {
    validatePayment(a, p, requestedId)
    const recorded = await store.record(a, p)
    if (p.status === 'refunded' || p.amount_refunded > 0) {
      await store.resolve(p.id, 'review', 'refund_detected')
      return review(p.id, 'refund_detected')
    }
    if (recorded.resolution === 'review') return review(p.id, recorded.review_code)
    if (p.status !== 'captured') {
      if (a.status === 'confirmed' && a.payment_id === p.id) return confirmed(a)
      if (p.status === 'failed') {
        await store.resolve(p.id, 'failed')
        return { success: false, state: 'failed', message: 'Payment failed. No booking was created.' }
      }
      return { success: false, state: 'pending', message: 'Payment is not captured yet. Check again without paying again.' }
    }
    if (!a.passenger_name || !a.passenger_age || !a.passenger_gender) {
      await store.resolve(p.id, 'review', 'missing_passenger')
      return review(p.id, 'missing_passenger')
    }
    try {
      const result = await reservations.finalize(a.user_id, input(a), p)
      await store.resolve(p.id, 'finalized')
      return { ...confirmed(a), ...result }
    } catch (err) {
      if (!(err instanceof HttpError) || err.status !== 409) throw err
      // Expired/released/cancelled/conflicting seats are never reclaimed after
      // payment. Persist a durable review case instead of losing the payment.
      await store.resolve(p.id, 'review', 'booking_conflict')
      return review(p.id, 'booking_conflict')
    }
  }
  async function reconcile(a) {
    a = await recoverOrder(a)
    if (!a.order_id) return { success: false, state: 'pending', message: 'Order creation is unresolved. Do not start another payment.' }
    const order = await gateway.fetchOrder(a.order_id)
    validateOrder(a, order)
    const payments = await gateway.orderPayments(a.order_id)
    let result = { success: false, state: 'pending', message: 'No captured payment found yet.' }
    // Process every payment, not merely the first; an extra capture needs review.
    for (const item of payments) {
      const p = await gateway.fetchPayment(providerId(item.id, 'pay'))
      const outcome = await processPayment(await store.get(a.id), p, item.id)
      if (outcome.state === 'review' || (result.state !== 'review' && (outcome.success || !result.success))) result = outcome
    }
    await store.checked(a.id)
    return result
  }
  return {
    async order(userId, body) {
      const config = gateway.config()
      const prepared = await reservations.preparePayment(userId, body)
      let a = prepared.attempt
      if (prepared.shouldCreate) {
        try { a = await associate(a, await gateway.createOrder(a)) }
        catch (err) { await store.uncertain(a.id); throw err }
      } else a = await recoverOrder(a)
      if (!a.order_id) return { success: false, state: 'pending', message: 'Order creation is being reconciled. Retry this attempt.' }
      // The seat may have expired during the external order request/recovery.
      await reservations.inspect(userId, body)
      if (!prepared.shouldCreate) {
        const order = await gateway.fetchOrder(a.order_id)
        validateOrder(a, order)
        const existing = await gateway.orderPayments(a.order_id)
        if (order.status === 'paid' || existing.some(p => p.status !== 'failed')) return reconcile(a)
      }
      return { id: a.order_id, amount: a.price * 100, currency: 'INR', keyId: config.keyId, attemptId: a.id }
    },
    async callback(userId, body) {
      const a = await store.owned(userId, body)
      const id = gateway.verifyCheckout(a, body)
      // A durable confirmed booking is enough for an authenticated, signed replay.
      if (a.status === 'confirmed' && a.payment_id === id) {
        const payment = await store.payment(id)
        if (payment?.resolution === 'review') return review(id, payment.review_code)
        await store.resolve(id, 'finalized')
        return confirmed(a)
      }
      const order = await gateway.fetchOrder(a.order_id)
      validateOrder(a, order)
      return processPayment(a, await gateway.fetchPayment(id), id)
    },
    async reconcileOwned(userId, body) { gateway.config(); return reconcile(await store.owned(userId, body)) },
    async reconcileAttempt(id) { gateway.config(); return reconcile(await store.get(id)) },
    async webhook(raw, signature, eventId) {
      gateway.verifyWebhook(raw, signature)
      let event
      try { event = JSON.parse(raw.toString('utf8')) } catch { throw new HttpError(400, 'Invalid webhook JSON') }
      if (!event || typeof event.event !== 'string') throw new HttpError(400, 'Invalid webhook event')
      if (!['payment.authorized','payment.captured','payment.failed','refund.created','refund.processed','refund.failed','order.paid'].includes(event.event)) return { received: true, ignored: true }
      const entity = event.payload?.payment?.entity
      const id = providerId(entity?.id, 'pay')
      const orderId = providerId(entity?.order_id, 'order')
      const hash = createHash('sha256').update(raw).digest('hex')
      // Deduplicate signed BODY, not just the unsigned event-ID header.
      if (await store.event(hash, typeof eventId === 'string' ? eventId.slice(0,100) : null, event.event) === 'processed') return { received: true, duplicate: true }
      const order = await gateway.fetchOrder(orderId)
      let a = await store.byOrder(orderId)
      if (!a) {
        // Recover an order accepted by Razorpay immediately before a DB failure.
        try { a = await store.get(order.receipt) }
        catch (err) { if (!(err instanceof HttpError) || ![400,404].includes(err.status)) throw err }
        if (a && a.order_state !== 'none') a = await associate(a, order)
        else { await store.eventDone(hash); return { received: true, ignored: true } }
      }
      validateOrder(a, order)
      const payment = await gateway.fetchPayment(id)
      const result = await processPayment(a, payment, id)
      // DB/provider errors are allowed to propagate: no acknowledgement until
      // recorded, so delivery retries and reconciliation can recover the work.
      await store.eventDone(hash)
      return { received: true, state: result.state }
    }
  }
}
