import { errorResponse, readBody } from './http.js'

export function createBookingHandlers({ auth, reservations, paymentFlow }) {
  const post = work => async req => {
    try {
      const body = await readBody(req)
      const user = await auth.requireUser(req)
      const result = await work(user.id, body)
      const status = result.state === 'review' ? 409 : result.state === 'failed' ? 402 : result.state === 'pending' ? 202 : 200
      return Response.json(result, { status, headers: { 'Cache-Control': 'no-store' } })
    } catch (err) { return errorResponse(err) }
  }
  const finalize = post((userId, body) => paymentFlow.callback(userId, body))
  return {
    lock: post((userId, body) => reservations.lock(userId, body)),
    release: post((userId, body) => reservations.release(userId, body)),
    cancel: post((userId, body) => reservations.cancel(userId, body)),
    book: finalize,
    confirm: finalize,
    payment: post((userId, body) => paymentFlow.order(userId, body)),
    reconcile: post((userId, body) => paymentFlow.reconcileOwned(userId, body)),
    async list(req) {
      try {
        return Response.json(await reservations.list(new URL(req.url).searchParams.get('flight')), { headers: { 'Cache-Control': 'no-store' } })
      } catch (err) { return errorResponse(err) }
    }
  }
}
