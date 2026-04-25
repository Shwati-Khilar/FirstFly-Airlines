import db from '@/lib/db'
import bcrypt from 'bcryptjs'

export async function POST(req) {
  try {
    const { email, password } = await req.json()

    // ✅ CORRECT QUERY
    const [rows] = await db.query(
      'SELECT * FROM users WHERE email = ?',
      [email]
    )

    if (rows.length === 0) {
      return Response.json({ error: 'User not found' }, { status: 400 })
    }

    const user = rows[0]

    const match = await bcrypt.compare(password, user.password)

if (!match) {
  return Response.json({ error: 'Invalid password' }, { status: 400 })
}

    // ✅ RETURN USER WITH ID
    return Response.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    })

  } catch (err) {
    console.error(err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}