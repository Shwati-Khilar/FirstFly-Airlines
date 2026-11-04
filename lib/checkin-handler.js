
import { createAuth } from './auth.js'
import { HttpError, errorResponse } from './http.js'

export function createCheckinHandler(db) { return async function GET(req) {
 try {
  const user = await createAuth(db).requireUser(req)
  const { searchParams } = new URL(req.url)

  const pnr = searchParams.get('pnr')
  const name = searchParams.get('name')
  if (!/^\d{6}$/.test(pnr || '') || !name || name.length > 100) throw new HttpError(400, 'Invalid booking details')

  const [rows] = await db.execute(
  `SELECT
    p.name,
    p.pnr,
    p.seat,
    p.travel_class,
    p.price,
    p.flight_id,
    f.flight_name,
    f.current_location,
    f.desired_location,
    f.departure_time,
    f.arrival_time
  FROM passengers p
  JOIN flights f
  ON p.flight_id = f.flight_code
  WHERE p.pnr = ? AND p.name = ? AND p.status='booked' AND p.user_id = ?`,
  [pnr, name, user.id]
)

  if (rows.length === 0) {
    return Response.json({ error: "Booking not found ❌" }, { status: 404 })
  }

  return Response.json(rows[0], { headers: { 'Cache-Control': 'no-store' } })
 } catch (err) { return errorResponse(err) }
}


}
