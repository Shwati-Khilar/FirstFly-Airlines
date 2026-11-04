import { paymentFlow } from '@/lib/booking-runtime'
import { createWebhookHandler } from '@/lib/webhook-handler'

export const runtime = 'nodejs'
export const POST = createWebhookHandler(paymentFlow)
