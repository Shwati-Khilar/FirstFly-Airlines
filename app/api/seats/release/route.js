import mysql from 'mysql2/promise'

export async function GET() {
  const db = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3307,
    user: 'appuser',
    password: '1234',
    database: 'flight_system'
  })

  await db.execute(`
    UPDATE seats 
    SET status='available', locked_by=NULL, lock_expiry=NULL
    WHERE lock_expiry < NOW()
  `)

  return Response.json({ success: true })
}