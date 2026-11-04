import { HttpError, errorResponse } from './http.js'

export function createWebhookHandler(flow) {
  return async req => {
    try {
      const limit = 1024 * 1024
      if (Number(req.headers.get('content-length')) > limit) throw new HttpError(413, 'Webhook too large')
      const reader = req.body?.getReader()
      if (!reader) throw new HttpError(400, 'Missing webhook body')
      const chunks = []
      let size = 0
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          size += value.length
          if (size > limit) { await reader.cancel(); throw new HttpError(413, 'Webhook too large') }
          chunks.push(Buffer.from(value))
        }
      } finally { reader.releaseLock() }
      const result = await flow.webhook(Buffer.concat(chunks), req.headers.get('x-razorpay-signature'), req.headers.get('x-razorpay-event-id'))
      return Response.json(result)
    } catch (err) { return errorResponse(err) }
  }
}
