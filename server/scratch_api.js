import { createNewApplication } from './controllers/appController.js';

async function run() {
  const req = {
    user: { id: 1 },
    body: {
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
      universityName: 'Test University',
      studyProgram: 'Computer Science',
      studyDuration: '',
    },
    files: {}
  };

  const res = {
    status: function(code) {
      console.log('Status:', code);
      return this;
    },
    json: function(data) {
      console.log('JSON:', data);
      return this;
    }
  };

  await createNewApplication(req, res);
  process.exit(0);
}

run();
