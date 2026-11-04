CREATE TABLE IF NOT EXISTS demo_flights (
  seed_key VARCHAR(80) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  flight_code INT NOT NULL UNIQUE,
  departure_at DATETIME NOT NULL,
  arrival_at DATETIME NOT NULL,
  timezone VARCHAR(40) NOT NULL DEFAULT 'Asia/Kolkata',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (flight_code) REFERENCES flights(flight_code)
) ENGINE=InnoDB;
