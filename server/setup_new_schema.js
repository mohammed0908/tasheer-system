import pool from './config/db.js';

async function setup() {
  try {
    console.log('Starting schema updates...');

    // 1. Create students table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS students (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        passport_no VARCHAR(100),
        nationality VARCHAR(100),
        phone VARCHAR(50),
        country_of_residence VARCHAR(100),
        city VARCHAR(100),
        guardian_name VARCHAR(255),
        guardian_phone VARCHAR(50),
        guardian_email VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    console.log('Created students table.');

    // 2. Create documents table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS documents (
        id INT AUTO_INCREMENT PRIMARY KEY,
        application_id INT NOT NULL,
        document_type VARCHAR(100) NOT NULL,
        file_path VARCHAR(255) NOT NULL,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
      )
    `);
    console.log('Created documents table.');

    // 3. Alter applications table
    const columnsToAdd = [
      'ADD COLUMN study_location VARCHAR(255)',
      'ADD COLUMN qualification VARCHAR(255)',
      'ADD COLUMN study_duration_months INT'
    ];

    for (const col of columnsToAdd) {
      try {
        await pool.query(`ALTER TABLE applications ${col}`);
        console.log(`Added column: ${col}`);
      } catch (err) {
        if (err.code === 'ER_DUP_FIELDNAME') {
          console.log(`Column already exists: ${col}`);
        } else {
          throw err;
        }
      }
    }

    console.log('Schema updates completed successfully.');
  } catch (error) {
    console.error('Error updating schema:', error);
  } finally {
    process.exit(0);
  }
}

setup();
