import db from '@/lib/db'
import { createAuth } from '@/lib/auth'
import { errorResponse } from '@/lib/http'

export async function GET(req) {
  try { return Response.json({ user: await createAuth(db).requireUser(req) }, { headers: { 'Cache-Control': 'no-store' } }) }
  catch (err) { return errorResponse(err) }
}
