import { createHash, randomBytes } from 'node:crypto'
import { HttpError } from './http.js'

const cookieName = 'firstfly_session'
const hash = token => createHash('sha256').update(token).digest('hex')
const cookie = (value, age) => `${cookieName}=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${age}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`

function tokenFrom(req) {
  const token = (req.headers.get('cookie') || '').split(';').map(x => x.trim()).find(x => x.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1)
  return /^[a-f0-9]{64}$/.test(token || '') ? token : null
}

export function createAuth(pool) {
  return {
    async login(user, req) {
      const previous = req && tokenFrom(req)
      if (previous) await pool.execute('DELETE FROM auth_sessions WHERE token_hash=?', [hash(previous)])
      const token = randomBytes(32).toString('hex')
      await pool.execute('INSERT INTO auth_sessions (token_hash, user_id, expires_at) VALUES (?, ?, NOW() + INTERVAL 7 DAY)', [hash(token), user.id])
      return Response.json({ user }, { headers: { 'Set-Cookie': cookie(token, 604800), 'Cache-Control': 'no-store' } })
    },
    async requireUser(req) {
      const token = tokenFrom(req)
      if (!token) throw new HttpError(401, 'Please sign in again')
      const [rows] = await pool.execute(`SELECT u.id, u.name, u.email FROM auth_sessions s
        JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at > NOW()`, [hash(token)])
      if (!rows.length) throw new HttpError(401, 'Please sign in again')
      return rows[0]
    },
    async logout(req) {
      const token = tokenFrom(req)
      if (token) await pool.execute('DELETE FROM auth_sessions WHERE token_hash=?', [hash(token)])
      return Response.json({ success: true }, { headers: { 'Set-Cookie': cookie('', 0), 'Cache-Control': 'no-store' } })
    }
  }
}
