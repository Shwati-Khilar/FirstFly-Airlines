import mysql from 'mysql2/promise'
import db from '@/lib/db'

export async function GET(req) {
  const { searchParams } = new URL(req.url)

  const pnr = searchParams.get('pnr')
  const name = searchParams.get('name')

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
  WHERE p.pnr = ? AND p.name = ?`,
  [pnr, name]
)

  if (rows.length === 0) {
    return Response.json({ error: "Booking not found ❌" }, { status: 404 })
  }

  return Response.json(rows[0])
}
