CREATE TABLE IF NOT EXISTS auth_rate_limits (
  bucket CHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  hits INT NOT NULL,
  expires_at DATETIME NOT NULL,
  INDEX auth_rate_expiry (expires_at)
) ENGINE=InnoDB;
