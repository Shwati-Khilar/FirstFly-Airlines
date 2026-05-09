import mysql from 'mysql2/promise'
import db from '@/lib/db'

export async function POST(req) {
  const { seatId, userId, flightId } = await req.json()


  const [result] = await db.execute(
  `UPDATE seats 
   SET status='locked', locked_by=?, lock_expiry=NOW() + INTERVAL 5 MINUTE
   WHERE seat_number=? AND flight_id=? AND (status='available' OR lock_expiry < NOW())`,
  [userId, seatId, flightId]
)

  if (result.affectedRows === 0) {
    return Response.json({ error: "Seat already locked/booked" }, { status: 400 })
  }

  return Response.json({ success: true })
}