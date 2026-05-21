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

  await connection.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      task_id INT AUTO_INCREMENT PRIMARY KEY,
      task_title VARCHAR(255) NOT NULL,
      task_status ENUM('pending', 'in-progress', 'completed') DEFAULT 'pending',
      due_date DATE,
      assigned_to INT,
      FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  console.log("Tasks table created successfully.");
  await connection.end();
}
main();
