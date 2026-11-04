import { createHmac } from 'node:crypto'
import { createPayments } from '../../lib/payments.js'

// Entirely test-only provider. Production imports never reference this module.
export const testEnv = { RAZORPAY_KEY_ID: 'rzp_test_fixture', RAZORPAY_KEY_SECRET: 'fixture-api-secret', RAZORPAY_WEBHOOK_SECRET: 'fixture-webhook-secret-only' }
export function paymentFixture(observe = () => {}) {
  const orders = new Map(), payments = new Map()
  let creates = 0
  const sdk = {
    orders: {
      async create(data) {
        observe()
        const order = { ...data, id: 'order_fixture' + ++creates, status: 'created' }
        orders.set(order.id, order)
        return structuredClone(order)
      },
      async all({receipt}) { observe(); return { items: structuredClone([...orders.values()].filter(o=>o.receipt===receipt)) } },
      async fetch(id) { observe(); if(!orders.has(id)) throw new Error('Unknown order'); return structuredClone(orders.get(id)) },
      async fetchPayments(id) { observe(); return { items: structuredClone([...payments.values()].filter(p=>p.order_id===id)) } }
    },
    payments: { async fetch(id) { observe(); if(!payments.has(id)) throw new Error('Unknown payment'); return structuredClone(payments.get(id)) } }
  }
  return {
    sdk, orders, payments, gateway: createPayments({ env: testEnv, sdk }), get creates() { return creates },
    pay(orderId, patch = {}) {
      const o = orders.get(orderId)
      const p = { id: 'pay_fixture' + (payments.size+1), order_id:orderId, amount:o.amount, currency:o.currency,
        status:'captured', captured:true, amount_refunded:0, ...patch }
      payments.set(p.id,p)
      if(p.status==='captured') o.status='paid'
      return p
    },
    proof(p) { return { razorpay_order_id:p.order_id, razorpay_payment_id:p.id,
      razorpay_signature:createHmac('sha256',testEnv.RAZORPAY_KEY_SECRET).update(p.order_id+'|'+p.id).digest('hex') } },
    event(p, event = 'payment.captured') {
      const raw=Buffer.from(JSON.stringify({event,payload:{payment:{entity:p}}}))
      return { raw, signature:createHmac('sha256',testEnv.RAZORPAY_WEBHOOK_SECRET).update(raw).digest('hex') }
    }
  }
}
