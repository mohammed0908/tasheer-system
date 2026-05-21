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

    const [rows] = await connection.query("SELECT id, full_name, email, password, role FROM users");
    console.log("Users in Database:");
    console.table(rows);
    
    await connection.end();
  } catch (error) {
    console.error("Error querying database:", error);
  }
}

main();
