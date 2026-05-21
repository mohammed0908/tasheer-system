import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
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
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('staff123', salt);

    // Delete existing to avoid duplicates if they run it multiple times
    await connection.query("DELETE FROM users WHERE email='staff@tasheer.agency'");

    const [res] = await connection.query(
      "INSERT INTO users (full_name, email, password, role) VALUES (?, ?, ?, ?)",
      ['Tasheer Staff', 'staff@tasheer.agency', hashedPassword, 'staff']
    );

    console.log(`Successfully created Staff user with ID: ${res.insertId}`);
  } catch (error) {
    console.error("Error creating staff user:", error.message);
  }

  await connection.end();
}
main();
