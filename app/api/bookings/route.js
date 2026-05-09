import db from '@/lib/db'

export async function GET(req) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId')

  if (!userId || userId === 'undefined') {
  return Response.json({ bookings: [] })
}

  const [rows] = await db.query(
  `SELECT 
    p.id,
    p.name,
    p.flight_id,
    p.seat,
    p.travel_class,
    p.price,
    p.pnr,
    p.status,
    f.current_location AS origin,
    f.desired_location AS destination,
    f.departure_time,
    f.arrival_time,
    f.flight_name
  FROM passengers p
  JOIN flights f ON p.flight_id = f.flight_code
  WHERE p.user_id = ?
  ORDER BY p.id DESC`,
  [userId]
)
  return Response.json({ bookings: rows })
}