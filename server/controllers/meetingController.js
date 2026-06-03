import db from '../config/db.js';
import { ensureNotificationsTable } from './taskController.js';

export const ensureMeetingsTable = async (connection = db) => {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS meetings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      application_id INT NOT NULL,
      client_id INT NOT NULL,
      counselor_id INT NOT NULL,
      topic VARCHAR(255) NOT NULL,
      requested_time DATETIME NOT NULL,
      duration INT DEFAULT 30,
      proposed_time DATETIME DEFAULT NULL,
      status ENUM('PENDING', 'PROPOSED', 'STUDENT_ACCEPTED', 'APPROVED', 'COMPLETED', 'CANCELLED') DEFAULT 'PENDING',
      meeting_link VARCHAR(255) DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE,
      FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (counselor_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  const statements = [
    'ALTER TABLE meetings ADD COLUMN duration INT DEFAULT 30',
    'ALTER TABLE meetings ADD COLUMN proposed_time DATETIME DEFAULT NULL',
    "ALTER TABLE meetings MODIFY status ENUM('PENDING', 'PROPOSED', 'STUDENT_ACCEPTED', 'APPROVED', 'COMPLETED', 'CANCELLED') DEFAULT 'PENDING'"
  ];

  for (const statement of statements) {
    try {
      await connection.query(statement);
    } catch (error) {
      if (error.code !== 'ER_DUP_FIELDNAME') {
        throw error;
      }
    }
  }
};

const isCounselor = (user) => {
  const department = String(user?.department || '').toLowerCase();
  const jobTitle = String(user?.job_title || '').toLowerCase();
  return department.includes('counselor') || jobTitle.includes('counselor');
};

const meetingSelect = `
  SELECT
    m.*,
    a.app_uid,
    a.university_name,
    a.program_name,
    client.full_name AS client_name,
    client.email AS client_email,
    counselor.full_name AS counselor_name,
    counselor.email AS counselor_email
  FROM meetings m
  JOIN applications a ON m.application_id = a.id
  JOIN users client ON m.client_id = client.id
  JOIN users counselor ON m.counselor_id = counselor.id
`;

const getMeetingStart = (meeting) => (
  meeting.status === 'PROPOSED' && meeting.proposed_time
    ? new Date(meeting.proposed_time)
    : new Date(meeting.requested_time)
);

const assertAtLeastOneHourAhead = (date) => {
  if (date.getTime() - Date.now() < 60 * 60 * 1000) {
    const error = new Error('Meetings must be requested at least 1 hour in advance.');
    error.statusCode = 400;
    throw error;
  }
};

const assertNoCounselorOverlap = async (connection, { counselorId, start, duration, excludeMeetingId = null }) => {
  const params = [counselorId];
  let excludeSql = '';
  if (excludeMeetingId) {
    excludeSql = 'AND id <> ?';
    params.push(excludeMeetingId);
  }

  const [meetings] = await connection.query(
    `SELECT id, requested_time, proposed_time, status, duration
     FROM meetings
     WHERE counselor_id = ?
       AND status NOT IN ('CANCELLED', 'COMPLETED')
       ${excludeSql}`,
    params
  );

  const newStart = new Date(start);
  const newEnd = new Date(newStart.getTime() + Number(duration || 30) * 60 * 1000);

  const hasOverlap = meetings.some(meeting => {
    const existingStart = getMeetingStart(meeting);
    const existingEnd = new Date(existingStart.getTime() + Number(meeting.duration || 30) * 60 * 1000);
    return newStart < existingEnd && newEnd > existingStart;
  });

  if (hasOverlap) {
    const error = new Error('The counselor is already booked for this time slot.');
    error.statusCode = 409;
    throw error;
  }
};

export const requestMeeting = async (req, res) => {
  const connection = await db.getConnection();

  try {
    await ensureMeetingsTable(connection);
    await ensureNotificationsTable(connection);

    const { application_id, topic, requested_time, duration = 30 } = req.body;

    if (!application_id || !topic || !requested_time) {
      return res.status(400).json({ message: 'Application, topic, and requested time are required' });
    }

    const requestedDate = new Date(requested_time);
    if (Number.isNaN(requestedDate.getTime())) {
      return res.status(400).json({ message: 'Requested time must be a valid date/time' });
    }

    assertAtLeastOneHourAhead(requestedDate);

    const meetingDuration = Number(duration) === 60 ? 60 : 30;

    const [applications] = await connection.query(
      `SELECT
        a.id,
        a.app_uid,
        a.student_id,
        a.client_id,
        a.counselor_id,
        a.assigned_staff_id,
        client.full_name AS client_name
       FROM applications a
       LEFT JOIN users client ON COALESCE(a.client_id, a.student_id) = client.id
       WHERE a.id = ? AND (a.client_id = ? OR a.student_id = ?)`,
      [application_id, req.user.id, req.user.id]
    );

    if (applications.length === 0) {
      return res.status(404).json({ message: 'Application not found for this client' });
    }

    const application = applications[0];
    const counselorId = application.counselor_id || application.assigned_staff_id;

    if (!counselorId) {
      return res.status(400).json({ message: 'No counselor is assigned to this application yet' });
    }

    await assertNoCounselorOverlap(connection, {
      counselorId,
      start: requestedDate,
      duration: meetingDuration
    });

    await connection.beginTransaction();

    const [result] = await connection.query(
      `INSERT INTO meetings (application_id, client_id, counselor_id, topic, requested_time, duration, status)
       VALUES (?, ?, ?, ?, ?, ?, 'PENDING')`,
      [application.id, req.user.id, counselorId, topic, requestedDate, meetingDuration]
    );

    await connection.query(
      `INSERT INTO notifications (user_id, message, type, application_id, app_uid, target_url, is_read)
       VALUES (?, ?, 'meeting_request', ?, ?, ?, FALSE)`,
      [
        counselorId,
        `New meeting request from ${application.client_name || 'a client'}`,
        application.id,
        application.app_uid,
        '/staff#action-queue'
      ]
    );

    await connection.commit();

    const [meetings] = await connection.query(`${meetingSelect} WHERE m.id = ?`, [result.insertId]);

    res.status(201).json({
      message: 'Meeting request sent to your counselor',
      meeting: meetings[0]
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error in requestMeeting:', error);
    res.status(error.statusCode || 500).json({
      message: error.statusCode ? error.message : 'Server error while requesting meeting',
      error: error.statusCode ? error.message : undefined
    });
  } finally {
    connection.release();
  }
};

export const getMeetings = async (req, res) => {
  try {
    await ensureMeetingsTable();

    if (req.user.role === 'client') {
      const [meetings] = await db.query(
        `${meetingSelect} WHERE m.client_id = ? ORDER BY m.requested_time ASC`,
        [req.user.id]
      );
      return res.json(meetings);
    }

    const [userRows] = await db.query(
      'SELECT id, role, department, job_title FROM users WHERE id = ?',
      [req.user.id]
    );
    const user = userRows[0] || req.user;

    if (req.user.role === 'staff' && isCounselor(user)) {
      const [meetings] = await db.query(
        `${meetingSelect} WHERE m.counselor_id = ? ORDER BY FIELD(m.status, 'PENDING', 'PROPOSED', 'STUDENT_ACCEPTED', 'APPROVED', 'COMPLETED', 'CANCELLED'), m.requested_time ASC`,
        [req.user.id]
      );
      return res.json(meetings);
    }

    if (req.user.role === 'admin') {
      const [meetings] = await db.query(
        `${meetingSelect} ORDER BY FIELD(m.status, 'PENDING', 'PROPOSED', 'STUDENT_ACCEPTED', 'APPROVED', 'COMPLETED', 'CANCELLED'), m.requested_time ASC`
      );
      return res.json(meetings);
    }

    return res.status(403).json({ message: 'Only clients, counselors, or admins can view meetings' });
  } catch (error) {
    console.error('Error in getMeetings:', error);
    res.status(500).json({ message: 'Server error while fetching meetings' });
  }
};

export const approveMeeting = async (req, res) => {
  const connection = await db.getConnection();

  try {
    await ensureMeetingsTable(connection);
    await ensureNotificationsTable(connection);

    const { meeting_link } = req.body;
    if (!meeting_link) {
      return res.status(400).json({ message: 'Meeting link is required' });
    }

    const [meetings] = await connection.query(
      `${meetingSelect} WHERE m.id = ?`,
      [req.params.id]
    );

    if (meetings.length === 0) {
      return res.status(404).json({ message: 'Meeting request not found' });
    }

    const meeting = meetings[0];
    if (Number(meeting.counselor_id) !== Number(req.user.id) && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only the assigned counselor can approve this meeting' });
    }

    if (!['PENDING', 'STUDENT_ACCEPTED'].includes(meeting.status)) {
      return res.status(400).json({ message: 'Only pending or student-accepted meetings can be approved' });
    }

    await assertNoCounselorOverlap(connection, {
      counselorId: meeting.counselor_id,
      start: meeting.requested_time,
      duration: meeting.duration,
      excludeMeetingId: meeting.id
    });

    await connection.beginTransaction();

    await connection.query(
      "UPDATE meetings SET status = 'APPROVED', meeting_link = ? WHERE id = ?",
      [meeting_link, meeting.id]
    );

    await connection.query(
      `INSERT INTO notifications (user_id, message, type, application_id, app_uid, target_url, is_read)
       VALUES (?, ?, 'meeting_approved', ?, ?, ?, FALSE)`,
      [
        meeting.client_id,
        'Your meeting request has been approved',
        meeting.application_id,
        meeting.app_uid,
        '/client#consultation'
      ]
    );

    await connection.commit();

    const [updatedMeetings] = await connection.query(`${meetingSelect} WHERE m.id = ?`, [meeting.id]);

    res.json({
      message: 'Meeting approved successfully',
      meeting: updatedMeetings[0]
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error in approveMeeting:', error);
    res.status(500).json({ message: 'Server error while approving meeting' });
  } finally {
    connection.release();
  }
};

export const proposeMeetingTime = async (req, res) => {
  const connection = await db.getConnection();

  try {
    await ensureMeetingsTable(connection);
    await ensureNotificationsTable(connection);

    const { proposed_time } = req.body;
    const proposedDate = new Date(proposed_time);
    if (!proposed_time || Number.isNaN(proposedDate.getTime())) {
      return res.status(400).json({ message: 'A valid proposed time is required' });
    }

    if (proposedDate.getTime() < Date.now()) {
      return res.status(400).json({ error: 'Proposed time cannot be in the past.' });
    }

    assertAtLeastOneHourAhead(proposedDate);

    const [meetings] = await connection.query(`${meetingSelect} WHERE m.id = ?`, [req.params.id]);
    if (meetings.length === 0) {
      return res.status(404).json({ message: 'Meeting request not found' });
    }

    const meeting = meetings[0];
    if (Number(meeting.counselor_id) !== Number(req.user.id) && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only the assigned counselor can propose a new time' });
    }

    if (!['PENDING', 'PROPOSED'].includes(meeting.status)) {
      return res.status(400).json({ message: 'Only pending meeting requests can receive a proposed time' });
    }

    await assertNoCounselorOverlap(connection, {
      counselorId: meeting.counselor_id,
      start: proposedDate,
      duration: meeting.duration,
      excludeMeetingId: meeting.id
    });

    await connection.beginTransaction();

    await connection.query(
      "UPDATE meetings SET status = 'PROPOSED', proposed_time = ? WHERE id = ?",
      [proposedDate, meeting.id]
    );

    await connection.query(
      `INSERT INTO notifications (user_id, message, type, application_id, app_uid, target_url, is_read)
       VALUES (?, ?, 'meeting_proposed', ?, ?, ?, FALSE)`,
      [
        meeting.client_id,
        'Your counselor proposed a new meeting time',
        meeting.application_id,
        meeting.app_uid,
        '/client#consultation'
      ]
    );

    await connection.commit();

    const [updatedMeetings] = await connection.query(`${meetingSelect} WHERE m.id = ?`, [meeting.id]);
    res.json({ message: 'New meeting time proposed', meeting: updatedMeetings[0] });
  } catch (error) {
    await connection.rollback();
    console.error('Error in proposeMeetingTime:', error);
    res.status(error.statusCode || 500).json({
      message: error.statusCode ? error.message : 'Server error while proposing meeting time',
      error: error.statusCode ? error.message : undefined
    });
  } finally {
    connection.release();
  }
};

export const acceptProposedMeetingTime = async (req, res) => {
  const connection = await db.getConnection();

  try {
    await ensureMeetingsTable(connection);
    await ensureNotificationsTable(connection);

    const [meetings] = await connection.query(`${meetingSelect} WHERE m.id = ?`, [req.params.id]);
    if (meetings.length === 0) {
      return res.status(404).json({ message: 'Meeting request not found' });
    }

    const meeting = meetings[0];
    if (Number(meeting.client_id) !== Number(req.user.id)) {
      return res.status(403).json({ message: 'Only the client can accept this proposed time' });
    }

    if (meeting.status !== 'PROPOSED' || !meeting.proposed_time) {
      return res.status(400).json({ message: 'This meeting does not have a proposed time to accept' });
    }

    await assertNoCounselorOverlap(connection, {
      counselorId: meeting.counselor_id,
      start: meeting.proposed_time,
      duration: meeting.duration,
      excludeMeetingId: meeting.id
    });

    await connection.beginTransaction();

    await connection.query(
      "UPDATE meetings SET requested_time = proposed_time, proposed_time = NULL, status = 'STUDENT_ACCEPTED' WHERE id = ?",
      [meeting.id]
    );

    await connection.query(
      `INSERT INTO notifications (user_id, message, type, application_id, app_uid, target_url, is_read)
       VALUES (?, ?, 'meeting_student_accepted', ?, ?, ?, FALSE)`,
      [
        meeting.counselor_id,
        `${meeting.client_name || 'Client'} accepted your proposed meeting time`,
        meeting.application_id,
        meeting.app_uid,
        '/staff#action-queue'
      ]
    );

    await connection.commit();

    const [updatedMeetings] = await connection.query(`${meetingSelect} WHERE m.id = ?`, [meeting.id]);
    res.json({ message: 'Proposed meeting time accepted', meeting: updatedMeetings[0] });
  } catch (error) {
    await connection.rollback();
    console.error('Error in acceptProposedMeetingTime:', error);
    res.status(error.statusCode || 500).json({
      message: error.statusCode ? error.message : 'Server error while accepting proposed meeting time',
      error: error.statusCode ? error.message : undefined
    });
  } finally {
    connection.release();
  }
};

export const cancelMeeting = async (req, res) => {
  const connection = await db.getConnection();

  try {
    await ensureMeetingsTable(connection);
    const [meetings] = await connection.query(`${meetingSelect} WHERE m.id = ?`, [req.params.id]);
    if (meetings.length === 0) {
      return res.status(404).json({ message: 'Meeting request not found' });
    }

    const meeting = meetings[0];
    const isOwner = Number(meeting.client_id) === Number(req.user.id);
    const isCounselorOwner = Number(meeting.counselor_id) === Number(req.user.id);
    if (!isOwner && !isCounselorOwner && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'You cannot cancel this meeting' });
    }

    await connection.query("UPDATE meetings SET status = 'CANCELLED' WHERE id = ?", [meeting.id]);
    res.json({ message: 'Meeting cancelled' });
  } catch (error) {
    console.error('Error in cancelMeeting:', error);
    res.status(500).json({ message: 'Server error while cancelling meeting' });
  } finally {
    connection.release();
  }
};
