import { createHash } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { createAuth } from './auth.js'
import { HttpError, readBody, errorResponse } from './http.js'
import { transaction } from './transaction.js'

// Shared database counters work across application workers. No untrusted proxy IP headers.
export async function throttle(pool, email) {
  for (const [key, limit] of [['global', 300], [`account:${email.toLowerCase()}`, 15]]) {
    const bucket = createHash('sha256').update(key).digest('hex')
    await pool.execute(`INSERT INTO auth_rate_limits (bucket,hits,expires_at) VALUES (?,1,NOW()+INTERVAL 15 MINUTE)
      ON DUPLICATE KEY UPDATE hits=IF(expires_at<=NOW(),1,hits+1),
      expires_at=IF(expires_at<=NOW(),NOW()+INTERVAL 15 MINUTE,expires_at)`, [bucket])
    const [rows] = await pool.execute('SELECT hits FROM auth_rate_limits WHERE bucket=?', [bucket])
    if (rows[0].hits > limit) throw new HttpError(429, 'Too many attempts. Please try again later.')
  }
}
// Valid bcrypt hash used only to equalize absent-user password comparison work.
const dummyHash = bcrypt.hashSync('non-user dummy comparison', 10)
export function createCredentialHandler(pool, register = false) {
  return async req => {
    try {
      const body = await readBody(req)
      const email = typeof body.email === 'string' ? body.email.trim() : ''
      const name = typeof body.name === 'string' ? body.name.trim() : ''
      const password = body.password
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 100 ||
        typeof password !== 'string' || !password || Buffer.byteLength(password) > 72 ||
        (register && (!name || name.length > 100 || password.length < 8))) {
        throw new HttpError(400, 'Provide valid credentials; registration requires a name and a password of at least 8 characters (maximum 72 bytes).')
      }
      await throttle(pool, email)
      if (register) {
        const hashed = await bcrypt.hash(password, 10)
        return await transaction(pool, async c => {
          const [result] = await c.execute('INSERT INTO users (name,email,password) VALUES (?,?,?)', [name,email,hashed])
          return createAuth(c).login({ id: result.insertId, name, email }, req)
        })
      }
      const [rows] = await pool.execute('SELECT id,name,email,password FROM users WHERE email=?', [email])
      const user = rows[0]
      const valid = await bcrypt.compare(password, user?.password || dummyHash)
      if (!user?.password || !valid) throw new HttpError(401, 'Invalid email or password')
      return await transaction(pool, c => createAuth(c).login({ id:user.id,name:user.name,email:user.email }, req))
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') return errorResponse(new HttpError(409, 'Unable to create account with these details.'))
      return errorResponse(err)
    }
  }
}
