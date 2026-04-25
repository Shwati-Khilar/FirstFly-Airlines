'use client'
import { useState } from 'react'
import Link from 'next/link'

export default function StatusPage() {
  const [input, setInput] = useState('')
  const [flight, setFlight] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSearch = async () => {
    if (!input) { setError('Please enter a Flight ID'); return }
    setLoading(true)
    setError('')
    setFlight(null)
    try {
      const res = await fetch(`/api/flights?id=${input}`)
      const data = await res.json()
      if (data.length > 0) setFlight(data[0])
      else setError('No flight found with that ID')
    } catch { setError('Error fetching flight data') }
    setLoading(false)
  }

  const statusConfig = {
    'On Time':  { color: '#2d7a4f', bg: 'rgba(45,122,79,0.15)',  dot: '#2d7a4f', label: 'On Time' },
    'Delayed':  { color: '#c0392b', bg: 'rgba(192,57,43,0.15)',  dot: '#c0392b', label: 'Delayed' },
    'Boarding': { color: '#b7770d', bg: 'rgba(183,119,13,0.15)', dot: '#b7770d', label: 'Now Boarding' },
    'Departed': { color: '#555',    bg: 'rgba(85,85,85,0.15)',   dot: '#999',    label: 'Departed' },
  }
  const status = statusConfig[flight?.status] || { color: '#1a5fa8', bg: 'rgba(26,95,168,0.12)', dot: '#1a5fa8', label: flight?.status || 'Scheduled' }
  const gate = flight ? `B${(parseInt(flight.flight_code) % 20) + 1}` : '--'
  const arrGate = flight ? `A${(parseInt(flight.flight_code) % 15) + 1}` : '--'

  return (
    <div style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", minHeight: '100vh', background: '#f0ebe0', position: 'relative', overflow: 'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,400&family=DM+Sans:wght@300;400;500&display=swap');
        .si { width:100%; background:rgba(255,255,255,0.85); border:1px solid rgba(0,0,0,0.1); border-radius:12px; padding:18px 20px; font-size:1rem; font-family:'DM Sans',sans-serif; color:#1a1a1a; transition:all .2s; box-sizing:border-box; }
        .si:focus { outline:none; background:white; border-color:rgba(0,0,0,0.25); box-shadow:0 0 0 3px rgba(0,0,0,0.05); }
        .si::placeholder { color:#aaa; }
        .cb { width:100%; background:#1a1a1a; color:white; border:none; border-radius:12px; padding:18px; font-size:0.8rem; letter-spacing:0.18em; font-family:'DM Sans',sans-serif; cursor:pointer; transition:all .2s; text-transform:uppercase; }
        .cb:hover:not(:disabled) { background:#333; transform:translateY(-1px); }
        .cb:disabled { opacity:.5; cursor:not-allowed; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
        .fu { animation:fadeUp 0.8s cubic-bezier(.22,1,.36,1) both; }
        .fu2 { animation:fadeUp 0.8s 0.12s cubic-bezier(.22,1,.36,1) both; }
        .fu3 { animation:fadeUp 0.7s 0.05s cubic-bezier(.22,1,.36,1) both; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.35} }
        .pulse { animation:pulse 1.8s ease-in-out infinite; }
        @keyframes planeFly { 0%{transform:translateX(-8px)} 100%{transform:translateX(8px)} }
        .plane { animation:planeFly 2s ease-in-out infinite alternate; display:inline-block; }
        .ic { background:rgba(255,255,255,0.7); border:1px solid rgba(255,255,255,0.9); backdrop-filter:blur(12px); border-radius:20px; transition:all .3s; }
        .ic:hover { box-shadow:0 12px 40px rgba(0,0,0,0.1); transform:translateY(-2px); }
      `}</style>

      {/* bg blobs */}
      <div style={{ position:'absolute', inset:0, zIndex:0 }}>
        <div style={{ position:'absolute', top:'10%', left:'-8%', width:'500px', height:'300px', background:'radial-gradient(ellipse, rgba(255,255,255,0.6) 0%, transparent 70%)', borderRadius:'50%' }} />
        <div style={{ position:'absolute', bottom:'20%', right:'-5%', width:'400px', height:'250px', background:'radial-gradient(ellipse, rgba(255,255,255,0.4) 0%, transparent 70%)', borderRadius:'50%' }} />
      </div>

      <div style={{ position:'relative', zIndex:10 }}>

        {/* ── SEARCH VIEW ── */}
        {!flight && (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'100vh', padding:'40px 24px' }}>
            <div className="fu" style={{ textAlign:'center', marginBottom:'48px' }}>
              <p style={{ fontSize:'0.7rem', letterSpacing:'0.25em', color:'#888', fontFamily:"'DM Sans',sans-serif", marginBottom:'16px', textTransform:'uppercase' }}>Live Tracking</p>
              <h1 style={{ fontSize:'clamp(2.4rem,5vw,3.8rem)', fontWeight:400, letterSpacing:'-0.02em', color:'#1a1a1a', margin:0, lineHeight:1.1 }}>
                Track Your <em style={{ fontStyle:'italic' }}>Flight</em>
              </h1>
            </div>

            <div className="fu2" style={{ background:'rgba(255,255,255,0.65)', backdropFilter:'blur(24px)', borderRadius:'24px', padding:'40px', width:'100%', maxWidth:'500px', border:'1px solid rgba(255,255,255,0.8)', boxShadow:'0 20px 60px rgba(0,0,0,0.08)' }}>
              <div style={{ marginBottom:'24px' }}>
                <label style={{ display:'block', fontSize:'0.65rem', letterSpacing:'0.18em', color:'#888', fontFamily:"'DM Sans',sans-serif", textTransform:'uppercase', marginBottom:'8px' }}>Flight ID</label>
                <input className="si" placeholder="E.g. 105, 110..." value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key==='Enter' && handleSearch()} />
              </div>
              <button className="cb" onClick={handleSearch} disabled={loading}>{loading ? 'Checking...' : 'Check Flight Status'}</button>
              {error && <p style={{ marginTop:'16px', textAlign:'center', color:'#c0392b', fontFamily:"'DM Sans',sans-serif", fontSize:'0.85rem' }}>{error}</p>}
              <div style={{ display:'flex', gap:'24px', marginTop:'28px', paddingTop:'24px', borderTop:'1px solid rgba(0,0,0,0.07)' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'8px' }}><span style={{ opacity:.5 }}>📡</span><span style={{ fontSize:'0.8rem', color:'#888', fontFamily:"'DM Sans',sans-serif" }}>Real-time updates</span></div>
                <div style={{ display:'flex', alignItems:'center', gap:'8px' }}><span style={{ opacity:.5 }}>🕐</span><span style={{ fontSize:'0.8rem', color:'#888', fontFamily:"'DM Sans',sans-serif" }}>Live gate info</span></div>
              </div>
            </div>

            <div style={{ display:'flex', justifyContent:'center', gap:'80px', marginTop:'60px', textAlign:'center' }}>
              {[{icon:'📡',label:'Live Updates'},{icon:'🛫',label:'Gate Alerts'},{icon:'⏱',label:'Delay Info'}].map(f=>(
                <div key={f.label} style={{ opacity:.4 }}>
                  <div style={{ fontSize:'1.8rem', marginBottom:'8px' }}>{f.icon}</div>
                  <p style={{ fontSize:'0.65rem', letterSpacing:'0.18em', fontFamily:"'DM Sans',sans-serif", textTransform:'uppercase', color:'#666', margin:0 }}>{f.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── RESULT DASHBOARD ── */}
        {flight && (
          <div className="fu3" style={{ maxWidth:'1100px', margin:'0 auto', padding:'40px 32px' }}>

            {/* TOP BAR */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'28px' }}>
              <div>
                <p style={{ fontSize:'0.7rem', letterSpacing:'0.18em', color:'#888', fontFamily:"'DM Sans',sans-serif", margin:'0 0 10px', textTransform:'uppercase' }}>
                  Flight {flight.flight_code} Status
                </p>
                <div style={{ display:'flex', alignItems:'center', gap:'16px' }}>
                  <div style={{ background:'#1a1a1a', color:'white', borderRadius:'100px', padding:'8px 20px', fontSize:'0.75rem', letterSpacing:'0.1em', fontFamily:"'DM Sans',sans-serif", textTransform:'uppercase' }}>
                    {flight.status==='Departed' ? 'Currently En Route' : flight.status==='Boarding' ? 'Now Boarding' : 'Scheduled'}
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                    <div className="pulse" style={{ width:'8px', height:'8px', borderRadius:'50%', background:status.dot }} />
                    <span style={{ fontSize:'0.85rem', color:status.color, fontFamily:"'DM Sans',sans-serif", fontWeight:500 }}>{status.label}</span>
                  </div>
                </div>
              </div>
              <div style={{ textAlign:'right' }}>
                <p style={{ fontSize:'0.65rem', letterSpacing:'0.15em', color:'#aaa', fontFamily:"'DM Sans',sans-serif", margin:'0 0 4px', textTransform:'uppercase' }}>Aircraft</p>
                <p style={{ fontSize:'1rem', fontWeight:500, margin:0, fontFamily:"'DM Sans',sans-serif" }}>{flight.flight_name}</p>
              </div>
            </div>

            {/* MAIN GRID */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 300px', gap:'16px', marginBottom:'16px' }}>

              {/* MAP */}
              <div style={{ position:'relative', borderRadius:'20px', overflow:'hidden', minHeight:'340px', background:'#0d1117' }}>
                <div style={{ position:'absolute', inset:0, background:'linear-gradient(135deg, #0d1117 0%, #1a2332 40%, #0f1923 70%, #1a1410 100%)' }} />
                <svg style={{ position:'absolute', inset:0, width:'100%', height:'100%', opacity:.07 }} xmlns="http://www.w3.org/2000/svg">
                  {[...Array(10)].map((_,i)=><line key={`h${i}`} x1="0" y1={`${i*10}%`} x2="100%" y2={`${i*10}%`} stroke="white" strokeWidth="0.5"/>)}
                  {[...Array(15)].map((_,i)=><line key={`v${i}`} x1={`${i*7}%`} y1="0" x2={`${i*7}%`} y2="100%" stroke="white" strokeWidth="0.5"/>)}
                </svg>
                <svg style={{ position:'absolute', inset:0, width:'100%', height:'100%' }} viewBox="0 0 600 340" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="pg" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#f0ebe0" stopOpacity="0.9"/>
                      <stop offset="100%" stopColor="#f0ebe0" stopOpacity="0.2"/>
                    </linearGradient>
                  </defs>
                  <path d="M 80 270 Q 300 70 520 190" stroke="url(#pg)" strokeWidth="1.5" fill="none" strokeDasharray="6 4"/>
                  <circle cx="80" cy="270" r="5" fill="#f0ebe0" opacity="0.9"/>
                  <circle cx="520" cy="190" r="5" fill="#f0ebe0" opacity="0.5"/>
                </svg>
                <div className="plane" style={{ position:'absolute', top:'36%', left:'47%', fontSize:'1.4rem', color:'white', filter:'drop-shadow(0 0 8px rgba(255,255,255,0.6))' }}>✈</div>
                <div style={{ position:'absolute', top:'20px', left:'20px', display:'flex', gap:'12px' }}>
                  {[{label:'Altitude',value:'35,000 FT'},{label:'Ground Speed',value:'520 KTS'}].map(item=>(
                    <div key={item.label} style={{ background:'rgba(255,255,255,0.12)', backdropFilter:'blur(12px)', borderRadius:'12px', padding:'12px 16px', border:'1px solid rgba(255,255,255,0.15)' }}>
                      <p style={{ fontSize:'0.58rem', letterSpacing:'0.15em', color:'rgba(255,255,255,0.5)', fontFamily:"'DM Sans',sans-serif", margin:'0 0 4px', textTransform:'uppercase' }}>{item.label}</p>
                      <p style={{ fontSize:'1.1rem', fontWeight:700, color:'white', margin:0, fontFamily:"'DM Sans',sans-serif" }}>{item.value}</p>
                    </div>
                  ))}
                </div>
                <div style={{ position:'absolute', bottom:'20px', left:'20px', background:'rgba(255,255,255,0.12)', backdropFilter:'blur(12px)', borderRadius:'12px', padding:'14px 18px', border:'1px solid rgba(255,255,255,0.15)', maxWidth:'260px' }}>
                  <p style={{ fontSize:'0.58rem', letterSpacing:'0.15em', color:'rgba(255,255,255,0.5)', fontFamily:"'DM Sans',sans-serif", margin:'0 0 4px', textTransform:'uppercase' }}>Current Position</p>
                  <p style={{ fontSize:'0.82rem', color:'rgba(255,255,255,0.85)', margin:0, fontFamily:"'DM Sans',sans-serif", lineHeight:1.5 }}>
                    En route from {flight.current_location?.trim()} to {flight.desired_location?.trim()}
                  </p>
                </div>
                <div style={{ position:'absolute', bottom:'20px', right:'20px', display:'flex', gap:'8px' }}>
                  {['+','−'].map(s=>(
                    <button key={s} style={{ width:'36px', height:'36px', borderRadius:'50%', background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.2)', color:'white', fontSize:'1.1rem', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(8px)' }}>{s}</button>
                  ))}
                </div>
              </div>

              {/* RIGHT */}
              <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
                <div className="ic" style={{ padding:'22px' }}>
                  <p style={{ fontSize:'0.62rem', letterSpacing:'0.15em', color:'#aaa', fontFamily:"'DM Sans',sans-serif", margin:'0 0 4px', textTransform:'uppercase' }}>Destination Weather</p>
                  <p style={{ fontSize:'0.88rem', fontWeight:500, margin:'0 0 10px', fontFamily:"'DM Sans',sans-serif" }}>{flight.desired_location?.trim()}</p>
                  <div style={{ display:'flex', alignItems:'baseline', gap:'10px', marginBottom:'14px' }}>
                    <span style={{ fontSize:'2.6rem', fontWeight:300, letterSpacing:'-0.04em' }}>28°</span>
                    <span style={{ fontSize:'0.88rem', color:'#888', fontFamily:"'DM Sans',sans-serif" }}>Partly Cloudy</span>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
                    {[{label:'Visibility',value:'9.5 MI'},{label:'Wind',value:'8 KTS W'}].map(w=>(
                      <div key={w.label}>
                        <p style={{ fontSize:'0.58rem', letterSpacing:'0.12em', color:'#aaa', fontFamily:"'DM Sans',sans-serif", margin:'0 0 2px', textTransform:'uppercase' }}>{w.label}</p>
                        <p style={{ fontSize:'0.88rem', fontWeight:500, margin:0, fontFamily:"'DM Sans',sans-serif" }}>{w.value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ padding:'22px', background:'#1a1a1a', borderRadius:'20px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'10px' }}>
                    <span style={{ fontSize:'1.3rem' }}>🚗</span>
                    <p style={{ fontSize:'0.58rem', letterSpacing:'0.15em', color:'rgba(255,255,255,0.35)', fontFamily:"'DM Sans',sans-serif", margin:0, textTransform:'uppercase' }}>Exclusive Service</p>
                  </div>
                  <p style={{ fontSize:'0.95rem', fontWeight:500, color:'white', margin:'0 0 6px', fontFamily:"'DM Sans',sans-serif" }}>Ground Transport</p>
                  <p style={{ fontSize:'0.78rem', color:'rgba(255,255,255,0.45)', margin:'0 0 16px', fontFamily:"'DM Sans',sans-serif", lineHeight:1.6 }}>Book a transfer waiting at the arrival terminal.</p>
                  <button style={{ width:'100%', background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.2)', color:'white', borderRadius:'10px', padding:'10px', fontSize:'0.68rem', letterSpacing:'0.15em', fontFamily:"'DM Sans',sans-serif", cursor:'pointer', textTransform:'uppercase' }}>
                    Book Transfer
                  </button>
                </div>
              </div>
            </div>

            {/* BOTTOM 3 */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'16px', marginBottom:'28px' }}>

              <div className="ic" style={{ padding:'28px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'14px' }}>
                  <span style={{ fontSize:'0.9rem', opacity:.5 }}>🛫</span>
                  <p style={{ fontSize:'0.62rem', letterSpacing:'0.15em', color:'#aaa', fontFamily:"'DM Sans',sans-serif", margin:0, textTransform:'uppercase' }}>Departure</p>
                </div>
                <p style={{ fontSize:'2.8rem', fontWeight:700, margin:'0 0 4px', letterSpacing:'-0.04em', lineHeight:1 }}>{flight.current_location?.trim().slice(0,3).toUpperCase()}</p>
                <p style={{ fontSize:'0.82rem', color:'#888', fontFamily:"'DM Sans',sans-serif", margin:'0 0 18px' }}>{flight.current_location?.trim()}</p>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px' }}>
                  <div>
                    <p style={{ fontSize:'0.58rem', letterSpacing:'0.12em', color:'#aaa', fontFamily:"'DM Sans',sans-serif", margin:'0 0 2px', textTransform:'uppercase' }}>Actual</p>
                    <p style={{ fontSize:'1rem', fontWeight:600, margin:0, fontFamily:"'DM Sans',sans-serif" }}>{flight.departure_time?.trim()}</p>
                  </div>
                  <div>
                    <p style={{ fontSize:'0.58rem', letterSpacing:'0.12em', color:'#aaa', fontFamily:"'DM Sans',sans-serif", margin:'0 0 2px', textTransform:'uppercase' }}>Gate</p>
                    <p style={{ fontSize:'1rem', fontWeight:600, margin:0, fontFamily:"'DM Sans',sans-serif" }}>{gate}</p>
                  </div>
                </div>
              </div>

              <div className="ic" style={{ padding:'28px', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', textAlign:'center' }}>
                <div style={{ width:'100%', height:'2px', background:'#e0d9ce', borderRadius:'2px', marginBottom:'20px', position:'relative' }}>
                  <div style={{ position:'absolute', left:0, top:0, height:'100%', width:'55%', background:'#1a1a1a', borderRadius:'2px' }} />
                  <div style={{ position:'absolute', left:'55%', top:'-6px', width:'14px', height:'14px', borderRadius:'50%', background:'#1a1a1a', transform:'translateX(-50%)' }} />
                </div>
                <p style={{ fontSize:'0.62rem', letterSpacing:'0.15em', color:'#aaa', fontFamily:"'DM Sans',sans-serif", margin:'0 0 6px', textTransform:'uppercase' }}>Remaining</p>
                <p style={{ fontSize:'2.2rem', fontWeight:700, margin:'0 0 8px', letterSpacing:'-0.04em', lineHeight:1, fontFamily:"'DM Sans',sans-serif" }}>
                  {flight.status==='Departed' ? '01H 20M' : flight.status==='Boarding' ? '00H 30M' : '02H 15M'}
                </p>
                <p style={{ fontSize:'0.78rem', color:'#aaa', fontFamily:"'DM Sans',sans-serif", margin:0 }}>
                  {flight.status==='Boarding' ? 'Boarding in progress' : 'Estimated flight time'}
                </p>
              </div>

              <div className="ic" style={{ padding:'28px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'14px' }}>
                  <span style={{ fontSize:'0.9rem', opacity:.5 }}>🛬</span>
                  <p style={{ fontSize:'0.62rem', letterSpacing:'0.15em', color:'#aaa', fontFamily:"'DM Sans',sans-serif", margin:0, textTransform:'uppercase' }}>Arrival</p>
                </div>
                <p style={{ fontSize:'2.8rem', fontWeight:700, margin:'0 0 4px', letterSpacing:'-0.04em', lineHeight:1 }}>{flight.desired_location?.trim().slice(0,3).toUpperCase()}</p>
                <p style={{ fontSize:'0.82rem', color:'#888', fontFamily:"'DM Sans',sans-serif", margin:'0 0 18px' }}>{flight.desired_location?.trim()}</p>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px' }}>
                  <div>
                    <p style={{ fontSize:'0.58rem', letterSpacing:'0.12em', color:'#aaa', fontFamily:"'DM Sans',sans-serif", margin:'0 0 2px', textTransform:'uppercase' }}>Estimated</p>
                    <p style={{ fontSize:'1rem', fontWeight:600, margin:0, fontFamily:"'DM Sans',sans-serif" }}>{flight.arrival_time?.trim()}</p>
                  </div>
                  <div>
                    <p style={{ fontSize:'0.58rem', letterSpacing:'0.12em', color:'#aaa', fontFamily:"'DM Sans',sans-serif", margin:'0 0 2px', textTransform:'uppercase' }}>Gate</p>
                    <p style={{ fontSize:'1rem', fontWeight:600, margin:0, fontFamily:"'DM Sans',sans-serif" }}>{arrGate}</p>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ textAlign:'center', paddingBottom:'40px' }}>
              <button onClick={() => { setFlight(null); setInput(''); setError('') }}
                style={{ background:'transparent', border:'1px solid rgba(0,0,0,0.15)', borderRadius:'100px', padding:'10px 28px', fontSize:'0.8rem', letterSpacing:'0.12em', fontFamily:"'DM Sans',sans-serif", cursor:'pointer', color:'#555', transition:'all .2s' }}>
                ← Search Another Flight
              </button>
            </div>

          </div>
        )}

        
      </div>
      {/* FOOTER */}
      <div style={{position: 'relative',zIndex: 10,background: '#1a1a1a',color: '#f0ebe0',padding: '48px 60px',display: 'flex',justifyContent: 'space-between',alignItems: 'center'
      }}>              <div>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 700, fontSize: '1.1rem', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '8px' }}>
            FirstFly <span style={{ fontWeight: 300 }}>Airways</span>
          </div>
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.85rem', opacity: 0.5, margin: 0 }}>© 2026 FirstFly. Elevate your journey.</p>
        </div>
        <div style={{ display: 'flex', gap: '32px', fontFamily: "'DM Sans', sans-serif", fontSize: '0.85rem', opacity: 0.6 }}>
          {[['/flights', 'Flights'], ['/bookings', 'Bookings'], ['/checkin', 'Check-in'], ['/status', 'Status']].map(([href, label]) => (
            <Link key={href} href={href} style={{ color: '#f0ebe0', textDecoration: 'none' }}>{label}</Link>
          ))}
        </div>
      </div>
    </div>
  )
}