import mysql from 'mysql2/promise'

export async function POST(req) {
  const { seatId, userId } = await req.json()

  const db = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3307,
    user: 'appuser',
    password: '1234',
    database: 'flight_system'
  })

  const [result] = await db.execute(
    `UPDATE seats 
     SET status='locked', locked_by=?, lock_expiry=NOW() + INTERVAL 5 MINUTE
     WHERE id=? AND (status='available' OR lock_expiry < NOW())`,
    [userId, seatId]
  )

  if (result.affectedRows === 0) {
    return Response.json({ error: "Seat already locked/booked" }, { status: 400 })
  }

  return Response.json({ success: true })
}