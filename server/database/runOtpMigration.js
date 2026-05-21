import db from '../config/db.js';

const columns = [
  ['otp', 'VARCHAR(10) DEFAULT NULL'],
  ['otp_expiry', 'DATETIME DEFAULT NULL'],
  ['is_verified', 'BOOLEAN DEFAULT FALSE']
];

try {
  for (const [column, definition] of columns) {
    try {
      await db.query(`ALTER TABLE users ADD COLUMN ${column} ${definition}`);
      console.log(`Added users.${column}`);
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log(`users.${column} already exists`);
      } else {
        throw error;
      }
    }
  }

  await db.query("UPDATE users SET is_verified = TRUE WHERE role IN ('admin', 'staff')");
  console.log('Marked existing admin/staff accounts as verified');
} finally {
  await db.end();
}
