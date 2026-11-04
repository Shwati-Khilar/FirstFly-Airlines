-- Additive migration: does not rewrite existing passenger, booking, or seat data.
CREATE TABLE IF NOT EXISTS auth_sessions (
  token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  user_id INT NOT NULL,
  expires_at DATETIME NOT NULL,
  INDEX sessions_expiry (expires_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS reservation_attempts (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  user_id INT NOT NULL,
  seat_id INT NOT NULL,
  travel_class VARCHAR(20) NOT NULL,
  price INT NOT NULL,
  status ENUM('locked','released','confirmed','cancelled') NOT NULL DEFAULT 'locked',
  order_id VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin UNIQUE,
  payment_id VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin UNIQUE,
  passenger_id INT UNIQUE,
  pnr INT UNIQUE,
  booked_seat_id INT GENERATED ALWAYS AS (CASE WHEN status='confirmed' THEN seat_id ELSE NULL END) STORED,
  UNIQUE KEY one_confirmed_attempt_per_seat (booked_seat_id),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX attempts_seat (seat_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (seat_id) REFERENCES seats(id),
  FOREIGN KEY (passenger_id) REFERENCES passengers(id)
) ENGINE=InnoDB;

ALTER TABLE seats ADD COLUMN IF NOT EXISTS lock_attempt_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL;

CREATE INDEX IF NOT EXISTS passengers_flight ON passengers(flight_id);
CREATE INDEX IF NOT EXISTS passengers_payment ON passengers(payment_id);
CREATE INDEX IF NOT EXISTS passengers_pnr ON passengers(pnr);
