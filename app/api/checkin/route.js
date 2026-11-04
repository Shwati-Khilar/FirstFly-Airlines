import db from '@/lib/db'
import { createCheckinHandler } from '@/lib/checkin-handler'
export const GET = createCheckinHandler(db)
