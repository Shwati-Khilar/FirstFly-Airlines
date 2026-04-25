import db from '@/lib/db'
import bcrypt from 'bcryptjs'

export async function POST(req) {
  try {
    const { name, email, password } = await req.json()

    if (!email || !password) {
      return Response.json({ error: 'Missing fields' }, { status: 400 })
    }

    // check existing
    const [existing] = await db.query(
      'SELECT * FROM users WHERE email=?',
      [email]
    )

    if (existing.length > 0) {
      return Response.json({ error: 'User already exists' }, { status: 400 })
    }

    // hash password
    const hashed = await bcrypt.hash(password, 10)

    // insert user
    const [result] = await db.query(
      'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
      [name || '', email, hashed]
    )

    // ✅ CORRECT RESPONSE (NO JSX)
    return Response.json({
      user: {
        id: result.insertId,   // 🔥 IMPORTANT
        name,
        email
      }
    })

  } catch (err) {
    console.error(err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}