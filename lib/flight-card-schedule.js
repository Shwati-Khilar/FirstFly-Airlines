import { scheduleParts } from './flight-presentation.js'

export function validTravelDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(value + 'T00:00:00Z')
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0,10) === value
}

// Calendar arithmetic only: stored clock times are IST, not browser-local instants.
export function flightCardSchedule(flight, travelDate) {
  if (!validTravelDate(travelDate)) return null
  const departure = scheduleParts(flight.departure_time)
  const arrival = scheduleParts(flight.arrival_time)
  if (departure.time === '—' || arrival.time === '—') return null
  const minutes = time => {
    const [,hour,minute,period] = /^(\d{2}):(\d{2}) (AM|PM)$/.exec(time)
    return (+hour % 12 + (period === 'PM' ? 12 : 0)) * 60 + +minute
  }
  const arrivalDay = new Date(travelDate + 'T00:00:00Z')
  if (minutes(arrival.time) < minutes(departure.time)) arrivalDay.setUTCDate(arrivalDay.getUTCDate()+1)
  return {
    departure: {...departure,date:scheduleParts(travelDate+' 00:00').date},
    arrival: {...arrival,date:scheduleParts(arrivalDay.toISOString().slice(0,10)+' 00:00').date}
  }
}
