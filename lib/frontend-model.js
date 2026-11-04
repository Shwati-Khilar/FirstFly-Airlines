export function filterFlights(flights, from = '', to = '') {
  const normalize = value => String(value || '').trim().toLowerCase()
  return flights.filter(f => (!normalize(from) || normalize(f.current_location) === normalize(from)) &&
    (!normalize(to) || normalize(f.desired_location) === normalize(to)))
}
export function seatClass(seat) {
  if (!/^[A-F](?:[1-9]|1[0-5])$/.test(seat)) return null
  return Number(seat.slice(1)) <= 3 ? 'Business' : 'Economy'
}
export function verifiedBooking(bookings, pnr) {
  return bookings.find(b => String(b.pnr) === pnr && b.status === 'booked') || null
}
export function filterTrips(bookings, tab) {
  return bookings.filter(b => tab === 'history' || (tab === 'active' ? b.status === 'booked' : b.status === 'cancelled'))
}
