import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
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

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('admin123', salt);

    await connection.query("DELETE FROM users WHERE email='admin@tasheer.agency'");

    const [result] = await connection.query(
      `INSERT INTO users (full_name, email, password, role) VALUES (?, ?, ?, ?)`,
      ['Tasheer Admin', 'admin@tasheer.agency', hashedPassword, 'admin']
    );

    console.log(`Successfully inserted Admin User with ID: ${result.insertId}`);
    
    await connection.end();
  } catch (error) {
    console.error("Error setting up admin user:", error);
  }
}

main();
