CREATE INDEX IF NOT EXISTS flights_origin ON flights(current_location);
CREATE INDEX IF NOT EXISTS flights_destination ON flights(desired_location);
CREATE INDEX IF NOT EXISTS passengers_owner ON passengers(user_id);
