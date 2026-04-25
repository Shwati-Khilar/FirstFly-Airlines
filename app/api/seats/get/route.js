import mysql from 'mysql2/promise'

export async function GET(req) {
  const { searchParams } = new URL(req.url)
  const flightId = searchParams.get('flight')

  const db = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3307,
    user: 'appuser',
    password: '1234',
    database: 'flight_system'
  })

  // Clear expired locks first
  await db.execute(`
    UPDATE seats 
    SET status='available', locked_by=NULL, lock_expiry=NULL
    WHERE lock_expiry < NOW()
  `)

  const [rows] = await db.execute(
    "SELECT * FROM seats WHERE flight_id = ?",
    [flightId]
  )

  return Response.json(rows)
}