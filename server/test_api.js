import fs from 'fs';
import pool from './config/db.js';

async function test() {
  try {
    const [users] = await pool.query('SELECT id, role FROM users WHERE role IN ("admin", "staff") LIMIT 1');
    if (users.length === 0) {
      console.log('No staff/admin user found');
      process.exit(1);
    }
    
    import('jsonwebtoken').then(async (jwtModule) => {
      const jwt = jwtModule.default || jwtModule;
      const token = jwt.sign({ id: users[0].id, role: users[0].role }, process.env.JWT_SECRET || 'your_super_secret_jwt_key_here', { expiresIn: '30d' });
      
      const form = new FormData();
      form.append('firstName', 'Test');
      form.append('lastName', 'User');
      form.append('email', 'test3@example.com');
      form.append('universityName', 'Test Univ');
      form.append('studyProgram', 'Program X');
      form.append('studyDuration', '');

      console.log('Sending request...');
      try {
        const response = await fetch('http://localhost:5000/api/applications/new', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`
          },
          body: form
        });
        const data = await response.json();
        console.log('Status:', response.status);
        console.log('Data:', data);
      } catch (err) {
        console.log('Fetch Error:', err);
      }
      process.exit(0);
    });

  } catch(e) {
    console.error(e);
    process.exit(1);
  }
}

test();
