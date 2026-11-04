-- Additive only. Existing reservation and passenger values are preserved.
ALTER TABLE reservation_attempts
  ADD COLUMN IF NOT EXISTS passenger_name VARCHAR(50) NULL,
  ADD COLUMN IF NOT EXISTS passenger_age INT NULL,
  ADD COLUMN IF NOT EXISTS passenger_gender VARCHAR(10) NULL,
  ADD COLUMN IF NOT EXISTS order_state ENUM('none','creating','ready','uncertain') NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS reconciled_at DATETIME NULL;

CREATE TABLE IF NOT EXISTS payment_records (
  payment_id VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  attempt_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  order_id VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  amount BIGINT NOT NULL,
  currency VARCHAR(3) NOT NULL,
  provider_status VARCHAR(20) NOT NULL,
  resolution ENUM('pending','failed','finalized','review') NOT NULL DEFAULT 'pending',
  review_code VARCHAR(50) NULL,
  checked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX payment_attempt (attempt_id),
  INDEX payment_review (resolution,checked_at),
  FOREIGN KEY (attempt_id) REFERENCES reservation_attempts(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS payment_webhook_events (
  body_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  event_id VARCHAR(100) NULL,
  event_type VARCHAR(50) NOT NULL,
  state ENUM('pending','processed') NOT NULL DEFAULT 'pending',
  received_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at DATETIME NULL
) ENGINE=InnoDB;
