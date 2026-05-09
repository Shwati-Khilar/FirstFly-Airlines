'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'

export default function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
 const [user, setUser] = useState<any>(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement | null>(null)

  const links = [
    ['/flights', 'Flights'],
    ['/checkin', 'Check-in'],
    ['/status', 'Status'],
    ['/my_trips', 'My Trips'],
  ]

  // Re-read user on every route change
  useEffect(() => {
    const stored = localStorage.getItem('firstfly_user')
    if (stored) setUser(JSON.parse(stored))
    else setUser(null)
  }, [pathname])

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('firstfly_user')
    setUser(null)
    setDropdownOpen(false)
    router.push('/login')
  }

  return (
    <nav style={{
      fontFamily: "'DM Sans', sans-serif",
      background: '#f0ebe0',
      borderBottom: '1px solid rgba(0,0,0,0.08)',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '20px 60px',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      backdropFilter: 'blur(12px)'
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;500;700&family=DM+Sans:wght@300;400;500&display=swap');

        .avatar-btn {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: #1a1a1a;
          color: #f0ebe0;
          border: none;
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
          font-family: 'DM Sans', sans-serif;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: opacity 0.2s;
        }
        .avatar-btn:hover { opacity: 0.75; }

        .profile-dropdown {
          position: absolute;
          top: calc(100% + 12px);
          right: 0;
          background: #f0ebe0;
          border: 1px solid rgba(0,0,0,0.09);
          border-radius: 14px;
          box-shadow: 0 16px 48px rgba(0,0,0,0.13);
          min-width: 210px;
          overflow: hidden;
          z-index: 200;
          animation: dropIn 0.18s ease both;
        }
        @keyframes dropIn {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .dropdown-item {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          padding: 12px 18px;
          font-size: 0.82rem;
          color: #333;
          background: none;
          border: none;
          text-align: left;
          cursor: pointer;
          font-family: 'DM Sans', sans-serif;
          letter-spacing: 0.04em;
          transition: background 0.15s;
          box-sizing: border-box;
          text-decoration: none;
        }
        .dropdown-item:hover { background: rgba(0,0,0,0.05); }
        .dropdown-item.danger { color: #c0392b; }
      `}</style>

      {/* Brand — unchanged */}
      <Link href="/" style={{ textDecoration: 'none', color: '#1a1a1a' }}>
        <span style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 700, fontSize: '1.15rem', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          FirstFly <span style={{ fontWeight: 300 }}>Airways</span>
        </span>
      </Link>

      {/* Nav links — My Trips only shown when logged in */}
      <div style={{ display: 'flex', gap: '32px', alignItems: 'center' }}>
        {links.map(([href, label]) => {
          if (href === '/my_trips' && !user) return null
          return (
            <Link key={href} href={href} style={{
              color: pathname === href ? '#1a1a1a' : '#888',
              textDecoration: 'none',
              fontSize: '0.85rem',
              letterSpacing: '0.08em',
              fontWeight: pathname === href ? 500 : 400,
              borderBottom: pathname === href ? '1px solid #1a1a1a' : '1px solid transparent',
              paddingBottom: '2px',
              transition: 'all 0.2s'
            }}>
              {label}
            </Link>
          )
        })}
      </div>

      {/* Right side */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {!user ? (
          // Not logged in: Sign In link + Book Now (same as before)
          <>
            <Link href="/login" style={{
              color: '#888',
              textDecoration: 'none',
              fontSize: '0.82rem',
              letterSpacing: '0.08em',
              paddingBottom: '2px',
              borderBottom: '1px solid transparent',
              transition: 'all 0.2s'
            }}>
              Sign In
            </Link>
            <Link href="/flights">
              <button style={{ background: '#1a1a1a', color: '#f0ebe0', padding: '10px 24px', borderRadius: '100px', border: 'none', cursor: 'pointer', fontSize: '0.82rem', letterSpacing: '0.1em', fontFamily: "'DM Sans', sans-serif" }}>
                Book Now
              </button>
            </Link>
          </>
        ) : (
          // Logged in: Book Now + avatar dropdown
          <>
            <Link href="/flights">
              <button style={{ background: '#1a1a1a', color: '#f0ebe0', padding: '10px 24px', borderRadius: '100px', border: 'none', cursor: 'pointer', fontSize: '0.82rem', letterSpacing: '0.1em', fontFamily: "'DM Sans', sans-serif" }}>
                Book Now
              </button>
            </Link>

            <div ref={dropdownRef} style={{ position: 'relative' }}>
              <button className="avatar-btn" onClick={() => setDropdownOpen(!dropdownOpen)} title={user?.name || user?.email}>
                {(user?.name || user?.email || '?')[0].toUpperCase()}
              </button>

              {dropdownOpen && (
                <div className="profile-dropdown">
                  {/* User info header */}
                  <div style={{ padding: '14px 18px 10px', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: '0.88rem', color: '#1a1a1a' }}>{user?.name || 'Traveller'}</p>
                    <p style={{ margin: '2px 0 0', fontSize: '0.72rem', color: '#aaa' }}>{user?.email}</p>
                  </div>

                  <Link href="/my_trips" className="dropdown-item" onClick={() => setDropdownOpen(false)}>✈️ My Trips</Link>
                  <Link href="/my_trips" className="dropdown-item" onClick={() => setDropdownOpen(false)}>📋 Bookings</Link>
                  <Link href="/checkin" className="dropdown-item" onClick={() => setDropdownOpen(false)}>🎫 Check In</Link>

                  <div style={{ borderTop: '1px solid rgba(0,0,0,0.08)' }}>
                    <button className="dropdown-item danger" onClick={handleLogout}>🚪 Sign Out</button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </nav>
  )
}