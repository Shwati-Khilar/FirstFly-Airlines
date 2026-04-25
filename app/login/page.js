'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const router = useRouter()
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mode, setMode] = useState('login') // 'login' | 'register'

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const handleSubmit = async () => {
    if (!form.email || !form.password) { setError('Please fill in all fields'); return }
    setLoading(true)
    setError('')

    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })
      const data = await res.json()

      if (!res.ok || data.error) {
        setError(data.error || "Login failed")
        setLoading(false)
        return
      }
      // Store user in localStorage
      localStorage.setItem('firstfly_user', JSON.stringify(data.user))
      router.push('/')
    } catch {
      setError('Something went wrong. Please try again.')
    }
    setLoading(false)
  }

  return (
    <div style={{
      fontFamily: "'DM Sans', sans-serif",
      minHeight: '100vh',
      position: 'relative',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,400&family=DM+Sans:wght@300;400;500;600&display=swap');

        .auth-input {
          width: 100%;
          background: rgba(255,255,255,0.6);
          border: 1px solid rgba(0,0,0,0.1);
          border-radius: 10px;
          padding: 16px 18px;
          font-size: 0.95rem;
          font-family: 'DM Sans', sans-serif;
          color: #1a1a1a;
          transition: all 0.2s;
          box-sizing: border-box;
          outline: none;
        }
        .auth-input:focus {
          background: rgba(255,255,255,0.9);
          border-color: rgba(0,0,0,0.25);
          box-shadow: 0 0 0 3px rgba(0,0,0,0.05);
        }
        .auth-input::placeholder { color: #aaa; }

        .sign-btn {
          width: 100%;
          background: #1a1a1a;
          color: white;
          border: none;
          border-radius: 10px;
          padding: 17px;
          font-size: 0.75rem;
          letter-spacing: 0.2em;
          font-family: 'DM Sans', sans-serif;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          text-transform: uppercase;
        }
        .sign-btn:hover:not(:disabled) { background: #333; }
        .sign-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .social-btn {
          flex: 1;
          background: rgba(255,255,255,0.5);
          border: 1px solid rgba(0,0,0,0.1);
          border-radius: 10px;
          padding: 13px;
          font-size: 0.75rem;
          font-family: 'DM Sans', sans-serif;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          color: #1a1a1a;
          letter-spacing: 0.08em;
        }
        .social-btn:hover { background: rgba(255,255,255,0.8); }

        @keyframes fadeIn { from { opacity:0; transform: scale(0.97); } to { opacity:1; transform: scale(1); } }
        .card-anim { animation: fadeIn 0.6s cubic-bezier(.22,1,.36,1) both; }
      `}</style>

      {/* BG — luxury cabin interior */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
        <img
          src="https://images.unsplash.com/photo-1540339832862-474599807836?w=1600&q=90&auto=format&fit=crop"
          alt="cabin"
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)' }} />
      </div>

      {/* BRAND NAME */}
      <div style={{ position: 'relative', zIndex: 10, textAlign: 'center', padding: '36px 0 0' }}>
        <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.85rem', letterSpacing: '0.35em', color: 'rgba(255,255,255,0.9)', textTransform: 'uppercase', fontWeight: 400 }}>
          F I R S T F L Y
        </span>
      </div>

      {/* CARD */}
      <div style={{ position: 'relative', zIndex: 10, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div className="card-anim" style={{
          background: 'rgba(240,235,224,0.88)',
          backdropFilter: 'blur(32px)',
          WebkitBackdropFilter: 'blur(32px)',
          borderRadius: '24px',
          padding: '48px 44px',
          width: '100%',
          maxWidth: '440px',
          border: '1px solid rgba(255,255,255,0.6)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.25)',
        }}>

          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '36px' }}>
            <p style={{ fontSize: '0.65rem', letterSpacing: '0.25em', color: '#888', textTransform: 'uppercase', marginBottom: '12px' }}>
              {mode === 'login' ? 'Welcome Back' : 'Join Us'}
            </p>
            <h1 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '2.6rem', fontWeight: 400, color: '#1a1a1a', lineHeight: 1.15, margin: 0 }}>
              {mode === 'login' ? 'Access Your\nJourney' : 'Create Your\nAccount'}
            </h1>
          </div>

          {/* Fields */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '20px' }}>

            {mode === 'register' && (
              <div>
                <label style={{ fontSize: '0.62rem', letterSpacing: '0.18em', color: '#888', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>Full Name</label>
                <input className="auth-input" name="name" placeholder="Your full name" onChange={handleChange} />
              </div>
            )}

            <div>
              <label style={{ fontSize: '0.62rem', letterSpacing: '0.18em', color: '#888', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>Email Address</label>
              <input className="auth-input" name="email" type="email" placeholder="you@example.com" onChange={handleChange} />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ fontSize: '0.62rem', letterSpacing: '0.18em', color: '#888', textTransform: 'uppercase' }}>Password</label>
                {mode === 'login' && (
                  <span style={{ fontSize: '0.68rem', color: '#888', letterSpacing: '0.08em', cursor: 'pointer', textTransform: 'uppercase' }}>Forgot?</span>
                )}
              </div>
              <input className="auth-input" name="password" type="password" placeholder="••••••••" onChange={handleChange}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
            </div>
          </div>

          {error && (
            <p style={{ color: '#c0392b', fontSize: '0.82rem', textAlign: 'center', marginBottom: '16px' }}>{error}</p>
          )}

          {/* Submit */}
          <button className="sign-btn" onClick={handleSubmit} disabled={loading} style={{ marginBottom: '20px' }}>
            {loading ? 'Please wait...' : mode === 'login' ? 'Sign In to Account' : 'Create Account'}
          </button>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <div style={{ flex: 1, height: '1px', background: 'rgba(0,0,0,0.1)' }} />
            <span style={{ fontSize: '0.65rem', letterSpacing: '0.12em', color: '#aaa', textTransform: 'uppercase' }}>or continue with</span>
            <div style={{ flex: 1, height: '1px', background: 'rgba(0,0,0,0.1)' }} />
          </div>

          {/* Social */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '28px' }}>
            <button className="social-btn">
              <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>G</span> GOOGLE
            </button>
            <button className="social-btn">
              <span style={{ fontWeight: 700, fontSize: '0.85rem' }}></span> APPLE
            </button>
          </div>

          {/* Toggle */}
          <p style={{ textAlign: 'center', fontSize: '0.82rem', color: '#888', margin: 0 }}>
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <span
              onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}
              style={{ color: '#1a1a1a', fontWeight: 500, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: '2px' }}
            >
              {mode === 'login' ? 'Sign Up' : 'Sign In'}
            </span>
          </p>

        </div>
      </div>

      {/* Bottom tagline */}
      <div style={{ position: 'relative', zIndex: 10, textAlign: 'right', padding: '24px 40px 32px', color: 'rgba(255,255,255,0.5)', fontSize: '0.65rem', letterSpacing: '0.18em', textTransform: 'uppercase', lineHeight: 1.7 }}>
        Elevating the standards<br />of global private aviation.
      </div>

      {/* Footer bar */}
      <div style={{ position: 'relative', zIndex: 10, background: 'rgba(0,0,0,0.4)', borderTop: '1px solid rgba(255,255,255,0.08)', padding: '16px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.08em' }}>© 2026 FIRSTFLY AIRWAYS. ALL RIGHTS RESERVED.</span>
        <div style={{ display: 'flex', gap: '24px' }}>
          {['Privacy Policy', 'Terms of Service', 'Contact'].map(l => (
            <span key={l} style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.08em', cursor: 'pointer' }}>{l.toUpperCase()}</span>
          ))}
        </div>
      </div>
    </div>
  )
}