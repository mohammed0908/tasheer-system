import db from '../config/db.js';
import { ensureMeetingsTable } from '../controllers/meetingController.js';

try {
  await ensureMeetingsTable(db);
  console.log('meetings table ready');
} finally {
  await db.end();
}
