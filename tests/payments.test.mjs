import test from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { paymentConfig } from '../lib/payment-config.js'
import { verifyWebhookSignature, validateOrder, validatePayment, createPayments } from '../lib/payments.js'
import { createWebhookHandler } from '../lib/webhook-handler.js'
import { paymentFixture, testEnv } from './helpers/payment-fixture.mjs'

test('configuration rejects missing, inconsistent and unsafe keys without revealing secrets', () => {
  for (const env of [{}, {...testEnv,RAZORPAY_KEY_SECRET:''}, {...testEnv,RAZORPAY_KEY_ID:'bad'},
    {...testEnv,NEXT_PUBLIC_RAZORPAY_KEY_ID:'rzp_live_other'}]) {
    assert.throws(()=>paymentConfig(env),{status:503,message:'Payment configuration unavailable'})
  }
  for (const secret of [undefined,'short',testEnv.RAZORPAY_KEY_SECRET]) {
    assert.throws(()=>paymentConfig({...testEnv,RAZORPAY_WEBHOOK_SECRET:secret},{webhook:true}),{status:503})
  }
  assert.equal(paymentConfig(testEnv).keyId,testEnv.RAZORPAY_KEY_ID)
})

test('webhook requires signature of exact raw bytes with a separate secret', () => {
  const raw=Buffer.from('{ "event": "payment.captured", "name": "नमस्ते" }')
  const secret=testEnv.RAZORPAY_WEBHOOK_SECRET
  const signature=createHmac('sha256',secret).update(raw).digest('hex')
  verifyWebhookSignature(raw,signature,secret)
  assert.throws(()=>verifyWebhookSignature(Buffer.from(JSON.stringify(JSON.parse(raw))),signature,secret),{status:400})
  assert.throws(()=>verifyWebhookSignature(raw,signature,testEnv.RAZORPAY_KEY_SECRET),{status:400})
  assert.throws(()=>verifyWebhookSignature(raw,'0'.repeat(64),secret),{status:400})
})

test('order checks trusted amount, currency, ID, receipt and attempt association', () => {
  const a={id:'attempt',price:5000,order_id:'order_good'}
  const o={id:'order_good',amount:500000,currency:'INR',receipt:'attempt',notes:{attemptId:'attempt'},status:'created'}
  validateOrder(a,o)
  for (const patch of [{amount:1},{currency:'USD'},{id:'order_other'},{receipt:'other'},{notes:{}},{status:'bad'}]) assert.throws(()=>validateOrder(a,{...o,...patch}),{status:409})
})

test('payment checks ID, order, amount, currency, captured flag and refunds', () => {
  const a={price:5000,order_id:'order_good'}
  const p={id:'pay_good',order_id:'order_good',amount:500000,currency:'INR',status:'captured',captured:true,amount_refunded:0}
  validatePayment(a,p,'pay_good')
  for (const patch of [{id:'pay_other'},{order_id:'order_other'},{amount:1},{currency:'USD'},{captured:false},{status:'unknown'},{amount_refunded:-1}]) {
    assert.throws(()=>validatePayment(a,{...p,...patch},'pay_good'),{status:409})
  }
})

test('SDK failures are sanitized and missing configuration never calls the provider', async () => {
  let calls=0
  const sdk={orders:{create:async()=>{calls++;throw new Error('Authorization: SECRET')}}}
  await assert.rejects(createPayments({env:{},sdk}).createOrder({}),{status:503,message:'Payment configuration unavailable'})
  assert.equal(calls,0)
  await assert.rejects(createPayments({env:testEnv,sdk}).createOrder({id:'a',price:1}),{status:503,message:'Payment provider unavailable; retry the same attempt'})
})

test('webhook handler preserves bytes and enforces a bounded request body', async () => {
  const raw=' {"event":"payment.captured"}\n'
  const handler=createWebhookHandler({webhook:async(body)=>{assert.equal(body.toString(),raw);return {received:true}}})
  assert.equal((await handler(new Request('http://localhost',{method:'POST',body:raw}))).status,200)
  assert.equal((await handler(new Request('http://localhost',{method:'POST',body:'x'.repeat(1024*1024+1)}))).status,413)
})

test('checkout proof cannot swap order or payment ID', async () => {
  const f=paymentFixture()
  const a={id:'attempt',price:5000}
  const o=await f.gateway.createOrder(a); a.order_id=o.id
  const p=f.pay(o.id),proof=f.proof(p)
  assert.equal(f.gateway.verifyCheckout(a,proof),p.id)
  assert.throws(()=>f.gateway.verifyCheckout(a,{...proof,razorpay_order_id:'order_other'}),{status:400})
  assert.throws(()=>f.gateway.verifyCheckout(a,{...proof,razorpay_payment_id:'pay_other'}),{status:400})
})
