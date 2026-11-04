import mysql from 'mysql2/promise'
import { readFile, readdir } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

export async function auditDatabase(db) {
  const checks = {
    activeDuplicateSeats: `SELECT COUNT(*) n FROM (SELECT flight_id,
      CASE WHEN UPPER(REPLACE(TRIM(seat),' ','')) REGEXP '^[0-9]+[A-F]$'
      THEN CONCAT(RIGHT(UPPER(REPLACE(TRIM(seat),' ','')),1),LEFT(REPLACE(TRIM(seat),' ',''),CHAR_LENGTH(REPLACE(TRIM(seat),' ',''))-1))
      ELSE UPPER(REPLACE(TRIM(seat),' ','')) END canonical FROM passengers
      WHERE status IS NULL OR status<>'cancelled' GROUP BY flight_id,canonical HAVING COUNT(*)>1) x`,
    missingOwners: 'SELECT COUNT(*) n FROM passengers p LEFT JOIN users u ON u.id=p.user_id WHERE u.id IS NULL',
    missingSeatMatches: 'SELECT COUNT(*) n FROM passengers p LEFT JOIN seats s ON s.flight_id=p.flight_id AND s.seat_number=p.seat WHERE s.id IS NULL',
    duplicatePnrs: 'SELECT COUNT(*) n FROM (SELECT pnr FROM passengers WHERE pnr IS NOT NULL GROUP BY pnr HAVING COUNT(*)>1) x',
    duplicatePayments: 'SELECT COUNT(*) n FROM (SELECT payment_id FROM passengers WHERE payment_id IS NOT NULL GROUP BY payment_id HAVING COUNT(*)>1) x',
    expiredLocks: "SELECT COUNT(*) n FROM seats WHERE status='locked' AND lock_expiry<=NOW()",
    nonBookedInventory: "SELECT COUNT(*) n FROM passengers p JOIN seats s ON s.flight_id=p.flight_id AND s.seat_number=p.seat WHERE (p.status IS NULL OR p.status<>'cancelled') AND s.status<>'booked'"
  }
  const report = {}
  for (const [key, sql] of Object.entries(checks)) report[key] = (await db.query(sql))[0][0].n
  return report
}

export async function migrate(db) {
  const directory = new URL('../migrations/', import.meta.url)
  for (const file of (await readdir(directory)).filter(f => /^\d+.*\.sql$/.test(f)).sort()) {
    const sql = await readFile(new URL(file, directory), 'utf8')
    for (const statement of sql.split(';').map(s => s.trim()).filter(Boolean)) await db.query(statement)
  }
}

async function main() {
  const mode = process.argv[2]
  if (!['audit', 'apply'].includes(mode)) throw new Error('Use audit or apply')
  const db = await mysql.createConnection({ host: process.env.DB_HOST, port: process.env.DB_PORT,
    user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME })
  try {
    const [base] = await db.query("SELECT COUNT(*) n FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('users','passengers','seats','bookings')")
    if (base[0].n === 4) console.log('Read-only preflight:', await auditDatabase(db))
    else if (mode === 'audit') throw new Error('Run db:migrate first to create the base schema')
    else console.log('Creating missing base tables without changing existing records.')
    if (mode === 'apply') {
      await migrate(db)
      console.log('Additive migration applied. Existing booking records were not rewritten. Conflicting inventory remains blocked for review.')
    }
  } finally { await db.end() }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(err => { console.error('Database operation failed:', err.code || err.message); process.exitCode = 1 })
}
