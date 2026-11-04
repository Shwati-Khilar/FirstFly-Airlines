export class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

export function positiveId(value, label = 'ID') {
  if (!/^[1-9]\d*$/.test(String(value)) || !Number.isSafeInteger(Number(value))) {
    throw new HttpError(400, `Invalid ${label}`)
  }
  return Number(value)
}

export function seatInput(body) {
  const flightId = positiveId(body.flightId ?? body.flight_id, 'flight')
  // seatId remains a compatibility alias for the seat label, NEVER seats.id.
  const seat = body.seatNumber ?? body.seat ?? body.seatId
  if (typeof seat !== 'string' || !/^[A-F](?:[1-9]|1[0-5])$/.test(seat)) {
    throw new HttpError(400, 'Invalid seat number; use A1 through F15')
  }
  for (const value of [body.seatNumber, body.seat, body.seatId]) {
    if (value !== undefined && value !== seat) throw new HttpError(400, 'Conflicting seat identifiers')
  }
  if (body.flight_id !== undefined && Number(body.flight_id) !== flightId) throw new HttpError(400, 'Conflicting flight identifiers')
  return { flightId, seat }
}

export function attemptId(value) {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new HttpError(400, 'Invalid booking attempt')
  }
  return value
}

export function checkOrigin(req) {
  if (req.headers.get('sec-fetch-site') === 'cross-site') throw new HttpError(403, 'Cross-origin request denied')
  const origin = req.headers.get('origin')
  if (origin && origin !== new URL(req.url).origin) throw new HttpError(403, 'Cross-origin request denied')
}

export async function readBody(req) {
  checkOrigin(req)
  let body
  const reader = req.body?.getReader()
  if (!reader) throw new HttpError(400, 'Missing request body')
  const chunks = []
  let size = 0
  try {
    while (true) {
      const {done,value} = await reader.read()
      if (done) break
      size += value.length
      if (size > 32768) { await reader.cancel(); throw new HttpError(413, 'Request body too large') }
      chunks.push(Buffer.from(value))
    }
    body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch (err) {
    if (err instanceof HttpError) throw err
    throw new HttpError(400, 'Invalid JSON body')
  } finally { reader.releaseLock() }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'Invalid request body')
  return body
}

export function errorResponse(err) {
  if (err instanceof HttpError) return Response.json({ error: err.message }, { status: err.status, headers: { 'Cache-Control': 'no-store', ...(err.status === 429 ? { 'Retry-After': '900' } : {}) } })
  // Do not return SQL, credentials, or provider responses to clients.
  console.error('Request failed:', err.code || err.name || 'Unknown error')
  return Response.json({ error: 'Unable to complete the request. Please try again.' }, { status: 500 })
}
