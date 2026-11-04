import db from '@/lib/db'
import { createAuth } from '@/lib/auth'
import { checkOrigin, errorResponse } from '@/lib/http'

export async function POST(req) {
  try { checkOrigin(req); return await createAuth(db).logout(req) }
  catch (err) { return errorResponse(err) }
}
