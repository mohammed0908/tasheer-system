import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'tsms_user',
    password: process.env.DB_PASSWORD || 'tsms_password_123',
    database: process.env.DB_NAME || 'tsms_database'
  });

  try {
    const [rows] = await connection.query("DESCRIBE applications");
    console.log("Applications Schema:");
    console.table(rows);
  } catch (err) { console.log(err.message); }

  try {
    const [rows2] = await connection.query("DESCRIBE payments");
    console.log("Payments Schema:");
    console.table(rows2);
  } catch (err) { console.log(err.message); }

  await connection.end();
}
main();
