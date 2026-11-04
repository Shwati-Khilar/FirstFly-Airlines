import { createHmac, timingSafeEqual } from 'node:crypto'
import Razorpay from 'razorpay'
import sdkUtils from 'razorpay/dist/utils/razorpay-utils.js'
import { HttpError } from './http.js'
import { paymentConfig } from './payment-config.js'

export function providerId(value, kind) {
  if (typeof value !== 'string' || !new RegExp('^' + kind + '_[a-zA-Z0-9]{1,90}$').test(value)) throw new HttpError(400, 'Invalid payment identifier')
  return value
}

function constantTimeSignature(payload, signature, secret) {
  if (typeof secret !== 'string' || !secret) throw new HttpError(503, 'Payment configuration unavailable')
  if (typeof signature !== 'string' || !/^[a-f0-9]{64}$/i.test(signature)) throw new HttpError(400, 'Invalid payment signature')
  const expected = createHmac('sha256', secret).update(payload).digest()
  if (!timingSafeEqual(expected, Buffer.from(signature, 'hex'))) throw new HttpError(400, 'Invalid payment signature')
}

export function verifySignature(orderId, paymentId, signature, secret) {
  providerId(orderId, 'order'); providerId(paymentId, 'pay')
  constantTimeSignature(orderId + '|' + paymentId, signature, secret)
  // The installed SDK uses string equality internally. Reject unequal digests
  // with timingSafeEqual FIRST, then require the official SDK verification too.
  if (!sdkUtils.validatePaymentVerification({ order_id: orderId, payment_id: paymentId }, signature.toLowerCase(), secret)) throw new HttpError(400, 'Invalid payment signature')
}

export function verifyWebhookSignature(raw, signature, secret) {
  constantTimeSignature(raw, signature, secret)
  if (!Razorpay.validateWebhookSignature(raw, signature.toLowerCase(), secret)) throw new HttpError(400, 'Invalid webhook signature')
}

export function validateOrder(attempt, order) {
  providerId(order?.id, 'order')
  if ((attempt.order_id && order.id !== attempt.order_id) || order.receipt !== attempt.id ||
    order.notes?.attemptId !== attempt.id || !Number.isSafeInteger(attempt.price) || attempt.price <= 0 ||
    order.amount !== attempt.price * 100 || order.currency !== 'INR' || !['created','attempted','paid'].includes(order.status)) {
    throw new HttpError(409, 'Provider order does not match the reservation')
  }
}

export function validatePayment(attempt, payment, requestedId) {
  providerId(payment?.id, 'pay')
  if ((requestedId && payment.id !== requestedId) || payment.order_id !== attempt.order_id ||
    payment.amount !== attempt.price * 100 || payment.currency !== 'INR' ||
    !['created','authorized','captured','failed','refunded'].includes(payment.status) ||
    (payment.status === 'captured' && payment.captured !== true) ||
    !Number.isSafeInteger(payment.amount_refunded) || payment.amount_refunded < 0 || payment.amount_refunded > payment.amount) {
    throw new HttpError(409, 'Provider payment does not match the reservation')
  }
}

// Only tests inject an SDK client. Production always uses the official SDK.
export function createPayments({ env = process.env, sdk } = {}) {
  let cached
  function client() {
    const { keyId, keySecret } = paymentConfig(env)
    if (sdk) return sdk
    if (!cached) {
      cached = new Razorpay({ key_id: keyId, key_secret: keySecret })
      // SDK 2.9.6 exposes its Axios instance but has no public timeout option.
      cached.api.rq.defaults.timeout = 10000
    }
    return cached
  }
  async function call(work) {
    try { return await work(client()) }
    catch (err) {
      if (err instanceof HttpError) throw err
      // Provider/network errors can contain request auth. Never expose or log them.
      throw new HttpError(503, 'Payment provider unavailable; retry the same attempt')
    }
  }
  return {
    config: options => paymentConfig(env, options),
    verifyCheckout(attempt, body) {
      const { keySecret } = paymentConfig(env)
      const id = body.razorpay_payment_id ?? body.payment_id
      if (!attempt.order_id || body.razorpay_order_id !== attempt.order_id) throw new HttpError(400, 'Payment order mismatch')
      verifySignature(attempt.order_id, id, body.razorpay_signature, keySecret)
      return id
    },
    verifyWebhook(raw, signature) { verifyWebhookSignature(raw, signature, paymentConfig(env, { webhook: true }).webhookSecret) },
    createOrder: a => call(c => c.orders.create({ amount: a.price * 100, currency: 'INR', receipt: a.id, notes: { attemptId: a.id } })),
    findOrders: async id => {
      const result = await call(c => c.orders.all({ receipt: id, count: 100 }))
      if (!Array.isArray(result.items)) throw new HttpError(503, 'Invalid provider response')
      return result.items.filter(o => o.receipt === id)
    },
    fetchOrder: id => { providerId(id, 'order'); return call(c => c.orders.fetch(id)) },
    fetchPayment: id => { providerId(id, 'pay'); return call(c => c.payments.fetch(id)) },
    orderPayments: async id => {
      providerId(id, 'order')
      const result = await call(c => c.orders.fetchPayments(id))
      if (!Array.isArray(result.items)) throw new HttpError(503, 'Invalid provider response')
      return result.items
    }
  }
}
