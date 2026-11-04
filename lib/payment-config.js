import { HttpError } from './http.js'

export function paymentConfig(env = process.env, { webhook = false } = {}) {
  const keyId = env.RAZORPAY_KEY_ID || env.NEXT_PUBLIC_RAZORPAY_KEY_ID
  const keySecret = env.RAZORPAY_KEY_SECRET
  if (!/^rzp_(test|live)_[a-zA-Z0-9]+$/.test(keyId || '') ||
    typeof keySecret !== 'string' || !keySecret.trim() || keySecret !== keySecret.trim() ||
    (env.RAZORPAY_KEY_ID && env.NEXT_PUBLIC_RAZORPAY_KEY_ID && env.RAZORPAY_KEY_ID !== env.NEXT_PUBLIC_RAZORPAY_KEY_ID)) {
    throw new HttpError(503, 'Payment configuration unavailable')
  }
  const webhookSecret = env.RAZORPAY_WEBHOOK_SECRET
  if (webhook && (typeof webhookSecret !== 'string' || webhookSecret.length < 16 || webhookSecret !== webhookSecret.trim() || webhookSecret === keySecret)) {
    throw new HttpError(503, 'Webhook configuration unavailable')
  }
  return { keyId, keySecret, webhookSecret }
}
