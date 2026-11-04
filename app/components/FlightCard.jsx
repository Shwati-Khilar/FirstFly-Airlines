import Link from 'next/link'
import {cityCode} from '@/lib/flight-presentation'
import {flightCardSchedule} from '@/lib/flight-card-schedule'
import styles from './FlightCard.module.css'
export default function FlightCard({flight,travelDate}) {
  const dates = flightCardSchedule(flight,travelDate)
  return <article className={styles.card} aria-label={`${flight.flight_name}, flight ${flight.flight_code}`}>
    <header className={styles.header}>
      <div><p className={styles.eyebrow}>Airline</p><h2>{flight.flight_name}</h2></div>
      <span className={styles.number}>#{flight.flight_code}</span>
    </header>
    <div className={styles.route}>
      {[['Departure',flight.current_location,dates?.departure],['Arrival',flight.desired_location,dates?.arrival]].map(([label,city,schedule])=>{
        return <section key={label} className={styles.endpoint} aria-label={label}>
          <p className={styles.eyebrow}>{label}</p>
          <p className={styles.code}>{cityCode(city)}</p>
          <p className={styles.city}>{city?.trim() || 'Location unavailable'}</p>
          <p className={styles.date}>{schedule?.date || 'Schedule unavailable'}</p>
          <p className={styles.time}>{schedule?.time || '—'}</p>
        </section>
      })}
    </div>
    <p className={styles.zone}>All times IST (UTC+05:30)</p>
    <footer className={styles.footer}>
      <div><p className={styles.eyebrow}>Economy from</p><p className={styles.price}>{Number.isFinite(flight.price)?`₹${flight.price.toLocaleString('en-IN')}`:'Fare unavailable'}</p></div>
      {dates && <Link className={styles.book} href={`/book/${flight.flight_code}?date=${travelDate}`} aria-label={`Book flight ${flight.flight_code}`}>Book <span aria-hidden="true">→</span></Link>}
    </footer>
  </article>
}
