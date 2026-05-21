import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

async function main() {
  try {
    // 1. Connect as root to ensure tsms_user has 127.0.0.1 privileges!
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: ''
    });

    await connection.query("CREATE OR REPLACE USER 'tsms_user'@'127.0.0.1' IDENTIFIED BY 'tsms_password_123'");
    await connection.query("GRANT ALL PRIVILEGES ON *.* TO 'tsms_user'@'127.0.0.1' WITH GRANT OPTION");
    await connection.query("FLUSH PRIVILEGES");
    console.log("Fixed tsms_user@127.0.0.1 privileges.");
    
    await connection.query("USE tsms_database");

    // 2. Hash a password and insert a valid frontend user
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('Welcome123!', salt);

    // Delete any existing to avoid Unique Constraint errors
    await connection.query("DELETE FROM users WHERE email='student@tasheer.agency'");

    const [result] = await connection.query(
      `INSERT INTO users (full_name, email, password, role) VALUES (?, ?, ?, ?)`,
      ['Test Student', 'student@tasheer.agency', hashedPassword, 'client']
    );

    console.log(`Successfully inserted user with ID: ${result.insertId}`);
    
    await connection.end();
  } catch (error) {
    console.error("Error setting up dev user:", error);
  }
}

main();
