import mysql from "mysql2/promise";

const pool = globalThis.firstflyPool || mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 100,
  connectTimeout: 10000
})

// Reuse connections during Next.js development hot reloads.
if (process.env.NODE_ENV !== 'production') globalThis.firstflyPool = pool

export default pool;
