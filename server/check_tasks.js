import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || '127.0.0.1',
      user: process.env.DB_USER || 'tsms_user',
      password: process.env.DB_PASSWORD || 'tsms_password_123',
      database: process.env.DB_NAME || 'tsms_database'
    });

    try {
      const [rows] = await connection.query("DESCRIBE tasks");
      console.table(rows);
    } catch (err) {
      console.log("Tasks table does not exist or error:", err.message);
    }
    
    await connection.end();
  } catch (error) {
    console.error("Connection error:", error);
  }
}

main();
