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
    // Check if Mahir exists
    const [users] = await connection.query("SELECT id FROM users WHERE full_name LIKE '%Mahir%' OR email LIKE '%mahir%'");
    let studentId;

    if (users.length === 0) {
      console.log("Mahir not found. Creating Mahir as a client user...");
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('mahir123', salt);
      const [res] = await connection.query(
        "INSERT INTO users (full_name, email, password, role) VALUES (?, ?, ?, ?)",
        ['Mahir', 'mahir@tasheer.agency', hashedPassword, 'client']
      );
      studentId = res.insertId;
    } else {
      studentId = users[0].id;
    }

    console.log("Using Student ID:", studentId);

    // Insert the application
    await connection.query(`
      INSERT INTO applications (current_stage, status, created_at, student_id, university_name, program_name) 
      VALUES (4, 'pending', NOW(), ?, 'Universiti Tun Hussein Onn Malaysia (UTHM)', 'General Program')
    `, [studentId]);

    console.log("Successfully inserted application for Mahir!");
  } catch (error) {
    console.error("Error:", error.message);
  }

  await connection.end();
}
main();
