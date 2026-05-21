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
    CREATE TABLE IF NOT EXISTS payments (
      payment_id INT AUTO_INCREMENT PRIMARY KEY,
      client_id INT,
      application_id INT,
      amount DECIMAL(10, 2) NOT NULL,
      description VARCHAR(255),
      payment_status ENUM('pending', 'completed', 'overdue', 'rejected', 'Pending', 'Paid', 'Overdue', 'Pending Verification', 'Rejected') DEFAULT 'Pending',
      payment_date DATE,
      due_date DATE,
      receipt_path VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
    )
  `);

  console.log("Payments table created successfully.");
  await connection.end();
}
main();
