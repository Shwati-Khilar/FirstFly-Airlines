# ✈️ FirstFly Airlines

## 🚀 Introduction

**FirstFly** is a full-stack Air Ticket Booking System designed to simplify flight booking and management. It allows users to search for flights, book tickets, and manage their travel seamlessly, while also providing backend support for handling flight data, users, and bookings.

This project demonstrates real-world full-stack development using modern technologies and clean architecture.

---

## 📌 Description

FirstFly is built to replicate the core functionality of airline booking platforms. It includes both **user-side features** (searching, booking) and **system-side logic** (data handling, APIs, authentication).

The system is modular, scalable, and structured to reflect production-level applications.
The platform supports flight discovery across multiple Indian cities, enabling users to browse available flights, view schedules, and proceed with booking seamlessly.

A key highlight of the system is the interactive seat selection feature, where users can choose seats dynamically. The system ensures proper seat locking and prevents double booking, maintaining data consistency across sessions.

For payments, the application integrates Razorpay, supporting multiple methods including:

💳 Card Payments
🏦 Net Banking
📱 Wallets

All transactions are processed smoothly, ensuring a reliable checkout experience.

Once a booking is completed, users receive a digitally generated boarding pass, complete with flight details and a QR code. This enhances realism and mimics real airline systems.

The application also includes:
🔐 User Authentication System (Login/Register)
🧳 My Trips Dashboard to view booking history
🛫 Web Check-in Feature to retrieve boarding details using PNR
📡 Flight Status Tracking
🎨 Modern, responsive UI with smooth user experience

---

## ✨ Features

### 👤 User Features

- 💺 Real-time Seat Selection with locking mechanism
- ✈️ Flight booking system across India
- 💳 Razorpay Payment Integration (Card, Wallet, Netbanking)
- 🎫 Boarding Pass Generation with QR Code
- 🔐 User Authentication (Login/Register)
- 🧳 My Trips Dashboard (Booking history)
- 🛫 Web Check-in system using PNR
- 📡 Flight Status Tracking
- 🎨 Modern responsive UI
  
### ⚙️ System Features

* 📊 Manage flight data
* 🧾 Booking management system
* 💳 Payment integration
* 🔗 RESTful API architecture
* ⚡ Efficient request handling

---

## 🛠️ Tech Stack

### 🎨 Frontend

* React.js + Next.js 
* HTML, CSS, JavaScript
* Tailwind CSS / Bootstrap 

### ⚙️ Backend

* Next.js API Routes

### 🗄️ Database

* MariaDB

### 🔧 Tools & Others

* Git & GitHub
* Postman (API testing)

---

## 📂 Project Structure

```id="3b5d1c"
airline-system/
│
├── app/            # Frontend (UI components, pages)
├── api/            # Backend (routes, controllers)
├── models/         # Database models (if present)
├── routes/         # API routes
├── controllers/    # Business logic
├── config/         # Configuration files
├── package.json    # Dependencies
└── README.md
```

---

## ⚙️ Installation & Setup

### 1️⃣ Clone the Repository

```bash id="x3h91e"
git clone https://github.com/your-username/airline-system.git
cd airline-system
```

### 2️⃣ Install Dependencies

```bash id="0h4c2z"
npm install
```

### 3️⃣ Run the Application

```bash id="x9a2dw"
npm start
```

*(Update commands if using separate frontend/backend servers)*

---
## 🌐 API Endpoints (Sample)

| Method | Endpoint     | Description                 |
| ------ | ------------ | --------------------------- |
| GET    | /flights     | Fetch all available flights |
| GET    | /flights/:id | Get flight details          |
| POST   | /book        | Book a flight               |
| GET    | /booking/:id | Get booking details         |
| POST   | /login       | User login                  |
| POST   | /register    | User signup                 |

### ✈️ Seat & Check-in

| Method | Endpoint         | Description             |
| ------ | ---------------- | ----------------------- |
| GET    | /seats/:flightId | View available seats    |
| POST   | /select-seat     | Select a seat           |
| POST   | /checkin         | Perform flight check-in |

### 💳 Payment

| Method | Endpoint     | Description        |
| ------ | ------------ | ------------------ |
| POST   | /payment     | Process payment    |
| GET    | /payment/:id | Get payment status |

### 📊 Booking & Status

| Method | Endpoint           | Description              |
| ------ | ------------------ | ------------------------ |
| GET    | /status/:bookingId | Check booking status     |
| DELETE | /cancel/:id        | Cancel a booking         |
| GET    | /history           | Get user booking history |


---



## 🚧 Future Enhancements

* 📱 Mobile responsiveness improvements
* 📊 Admin dashboard
* ✈️ Real-time flight tracking

---

## 🤝 Contributing

Contributions are welcome!
Feel free to fork this repository and submit a pull request.

---



## 👩‍💻 Author

**Shwati Khilar**
🔗 GitHub: https://github.com/Shwati-Khilar
