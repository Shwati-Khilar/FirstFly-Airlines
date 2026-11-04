export async function transaction(pool, work) {
  const connection = await pool.getConnection()
  let reusable = true
  try {
    await connection.beginTransaction()
    const result = await work(connection)
    await connection.commit()
    return result
  } catch (err) {
    try { await connection.rollback() } catch {
      // Never return a connection with unknown transaction state to the pool.
      reusable = false
      connection.destroy()
    }
    throw err
  } finally {
    if (reusable) connection.release()
  }
}
