-- Base schema for empty installations. Existing tables and records are untouched.
CREATE TABLE IF NOT EXISTS `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL,
  `password` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

CREATE TABLE IF NOT EXISTS `flights` (
  `flight_code` int(11) NOT NULL,
  `flight_name` varchar(50) DEFAULT NULL,
  `current_location` varchar(50) DEFAULT NULL,
  `desired_location` varchar(50) DEFAULT NULL,
  `departure_time` varchar(20) DEFAULT NULL,
  `arrival_time` varchar(20) DEFAULT NULL,
  `price` int(11) DEFAULT NULL,
  `status` varchar(20) DEFAULT NULL,
  PRIMARY KEY (`flight_code`),
  KEY `flights_origin` (`current_location`),
  KEY `flights_destination` (`desired_location`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

CREATE TABLE IF NOT EXISTS `seats` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `flight_id` int(11) DEFAULT NULL,
  `seat_number` varchar(10) DEFAULT NULL,
  `status` enum('available','locked','booked') DEFAULT 'available',
  `locked_by` int(11) DEFAULT NULL,
  `lock_expiry` datetime DEFAULT NULL,
  `lock_attempt_id` char(36) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_flight_seat` (`flight_id`,`seat_number`),
  CONSTRAINT `fk_seats_flight` FOREIGN KEY (`flight_id`) REFERENCES `flights` (`flight_code`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

CREATE TABLE IF NOT EXISTS `passengers` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(50) DEFAULT NULL,
  `age` int(11) DEFAULT NULL,
  `gender` varchar(10) DEFAULT NULL,
  `flight_id` int(11) DEFAULT NULL,
  `price` int(11) DEFAULT NULL,
  `travel_class` varchar(20) DEFAULT NULL,
  `seat` varchar(10) DEFAULT NULL,
  `pnr` int(11) DEFAULT NULL,
  `payment_id` varchar(255) DEFAULT NULL,
  `payment_status` varchar(50) DEFAULT NULL,
  `status` enum('booked','cancelled') DEFAULT 'booked',
  `user_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `passengers_flight` (`flight_id`),
  KEY `passengers_payment` (`payment_id`),
  KEY `passengers_pnr` (`pnr`),
  KEY `passengers_owner` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

CREATE TABLE IF NOT EXISTS `bookings` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `flight_id` int(11) NOT NULL,
  `seat_id` int(11) DEFAULT NULL,
  `status` varchar(50) DEFAULT 'confirmed',
  `total_price` decimal(10,2) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `fk_user` (`user_id`),
  KEY `fk_seat` (`seat_id`),
  CONSTRAINT `fk_seat` FOREIGN KEY (`seat_id`) REFERENCES `seats` (`id`),
  CONSTRAINT `fk_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
