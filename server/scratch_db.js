import pool from './config/db.js';

async function describe() {
  try {
    const [tables] = await pool.query('SHOW TABLES');
    console.log('TABLES:', tables);
  } catch(err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
describe();
