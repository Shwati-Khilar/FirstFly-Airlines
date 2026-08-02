import mysql from 'mysql2/promise'  
import db from '@/lib/db'

export async function POST(req) {
  const { seatId, userId } = await req.json()
  // ...
  await db.execute(
    `UPDATE seats SET status='available', locked_by=NULL, lock_expiry=NULL
     WHERE seat_number=? AND locked_by=?`,
    [seatId, userId]
  )
  return Response.json({ success: true })
}