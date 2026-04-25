import mysql from 'mysql2/promise'

export async function POST(req) {
  const { seatId, userId, flightId, seatNumber } = await req.json()

  const db = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3307,
    user: 'appuser',
    password: '1234',
    database: 'flight_system'
  })

  try {
    // Step 1: Convert locked → booked
    const [result] = await db.execute(
      `UPDATE seats 
       SET status='booked' 
       WHERE id=? AND locked_by=? AND lock_expiry > NOW()`,
      [seatId, userId]
    )

    if (result.affectedRows === 0) {
      return Response.json({ error: "Seat lock expired" }, { status: 400 })
    }

    // Step 2: Save booking
    await db.execute(
      `INSERT INTO passengers (flight_id, seat) VALUES (?, ?)`,
      [flightId, seatNumber]
    )

    return Response.json({ success: true })

  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}