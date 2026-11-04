import db from '@/lib/db'
import { createCredentialHandler } from '@/lib/credentials'
export const POST = createCredentialHandler(db, true)
