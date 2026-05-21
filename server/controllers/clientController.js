import db from '../config/db.js';
import { ensureTaskColumns } from './taskController.js';

const ensureClientApplicationColumns = async (connection = db) => {
  const statements = [
    'ALTER TABLE applications MODIFY student_id INT NULL',
    'ALTER TABLE applications ADD COLUMN app_uid VARCHAR(50) NULL',
    'ALTER TABLE applications ADD COLUMN client_id INT DEFAULT NULL',
    'ALTER TABLE applications ADD COLUMN created_by_cs_id INT DEFAULT NULL',
    'ALTER TABLE applications ADD COLUMN counselor_id INT DEFAULT NULL',
    'ALTER TABLE applications ADD COLUMN applicant_name VARCHAR(255) DEFAULT NULL',
    'ALTER TABLE applications ADD COLUMN application_email VARCHAR(255) DEFAULT NULL',
    'ALTER TABLE applications ADD COLUMN applicant_phone VARCHAR(50) DEFAULT NULL',
    'ALTER TABLE applications ADD COLUMN applicant_passport_no VARCHAR(100) DEFAULT NULL',
    'ALTER TABLE applications ADD COLUMN applicant_nationality VARCHAR(100) DEFAULT NULL',
    'ALTER TABLE applications ADD COLUMN applicant_country_of_residence VARCHAR(100) DEFAULT NULL',
    'ALTER TABLE applications ADD COLUMN applicant_city VARCHAR(100) DEFAULT NULL',
    'ALTER TABLE applications ADD COLUMN guardian_name VARCHAR(255) DEFAULT NULL',
    'ALTER TABLE applications ADD COLUMN guardian_phone VARCHAR(50) DEFAULT NULL',
    'ALTER TABLE applications ADD COLUMN guardian_email VARCHAR(255) DEFAULT NULL',
    'ALTER TABLE applications ADD COLUMN missing_docs_note TEXT DEFAULT NULL'
  ];

  for (const statement of statements) {
    try {
      await connection.query(statement);
    } catch (error) {
      if (error.code !== 'ER_DUP_FIELDNAME') throw error;
    }
  }
};

const generateClientApplicationUid = async (connection = db) => {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const appUid = `APP-${Math.floor(100000 + Math.random() * 900000)}`;
    const [rows] = await connection.query('SELECT id FROM applications WHERE app_uid = ?', [appUid]);
    if (rows.length === 0) return appUid;
  }
  return `APP-${Date.now()}`;
};

const findExistingStudentEmail = async (connection, email) => {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) return null;

  const [userRows] = await connection.query(
    'SELECT id FROM users WHERE LOWER(email) = ? LIMIT 1',
    [normalizedEmail]
  );
  if (userRows.length > 0) return { source: 'users', id: userRows[0].id };

  const [applicationRows] = await connection.query(
    `SELECT id
     FROM applications
     WHERE LOWER(application_email) = ?
     LIMIT 1`,
    [normalizedEmail]
  );

  return applicationRows[0] ? { source: 'applications', id: applicationRows[0].id } : null;
};

const findExistingStudentPassport = async (connection, passportNo) => {
  const normalizedPassport = String(passportNo || '').trim().toLowerCase();
  if (!normalizedPassport) return null;

  const [studentRows] = await connection.query(
    'SELECT id FROM students WHERE LOWER(passport_no) = ? LIMIT 1',
    [normalizedPassport]
  );
  if (studentRows.length > 0) return { source: 'students', id: studentRows[0].id };

  const [applicationRows] = await connection.query(
    `SELECT id
     FROM applications
     WHERE LOWER(applicant_passport_no) = ?
     LIMIT 1`,
    [normalizedPassport]
  );

  return applicationRows[0] ? { source: 'applications', id: applicationRows[0].id } : null;
};

export const ensureDocumentUploaderColumn = async (connection = db) => {
  try {
    await connection.query("ALTER TABLE documents ADD COLUMN uploaded_by_role ENUM('client', 'staff', 'admin') DEFAULT NULL");
  } catch (error) {
    if (error.code !== 'ER_DUP_FIELDNAME') {
      throw error;
    }
  }
};

const toPublicFilePath = (filePath) => {
  if (!filePath) return '';
  const normalizedPath = filePath.replace(/\\/g, '/');
  return normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`;
};

const departmentAliases = {
  Ops: 'Operations',
  Accountant: 'Finance',
  'Financial Manager': 'Finance',
  'Junior Counselor': 'Counselor',
  'Senior Counselor': 'Counselor',
  'Customer Service Officer': 'Customer Service'
};

const normalizeDepartment = (user) => (
  departmentAliases[user?.department] ||
  departmentAliases[user?.job_title] ||
  user?.department ||
  user?.job_title ||
  ''
);

export const getAllClients = async (req, res) => {
  try {
    await ensureClientApplicationColumns();

    if (!req.user?.id) {
      return res.status(401).json({ message: 'Unauthorized: User role not found in request.' });
    }

    const [requestingUsers] = await db.query(
      'SELECT role, department, job_title FROM users WHERE id = ?',
      [req.user.id]
    );

    if (requestingUsers.length === 0) {
      return res.status(401).json({ message: 'Unauthorized: User role not found in request.' });
    }

    const requester = requestingUsers[0];
    const requesterDepartment = normalizeDepartment(requester);
    const whereClauses = [];
    const queryParams = [];

    if (requester.role !== 'admin') {
      if (requesterDepartment === 'Customer Service') {
        whereClauses.push('a.created_by_cs_id = ?');
        queryParams.push(req.user.id);
      } else if (requesterDepartment === 'Counselor') {
        whereClauses.push('a.counselor_id = ?');
        queryParams.push(req.user.id);
      }
    }

    const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const [clients] = await db.query(`
      SELECT 
        COALESCE(u.id, a.id) AS id, 
        u.id AS user_id,
        COALESCE(u.full_name, a.applicant_name) AS name, 
        COALESCE(u.email, a.application_email) AS email, 
        COALESCE(s.passport_no, a.applicant_passport_no) AS passport_no, 
        COALESCE(s.nationality, a.applicant_nationality) AS nationality, 
        COALESCE(s.phone, a.applicant_phone) AS phone,
        COALESCE(s.guardian_name, a.guardian_name) AS guardian_name,
        COALESCE(s.guardian_phone, a.guardian_phone) AS guardian_phone,
        COALESCE(s.guardian_email, a.guardian_email) AS guardian_email,
        a.id AS application_id,
        a.app_uid,
        a.university_name,
        a.program_name,
        a.qualification,
        a.study_location,
        a.study_duration_months,
        a.current_stage,
        a.status AS app_status,
        a.missing_docs_note,
        a.visa_progress,
        a.offer_letter_url,
        a.accommodation_id,
        a.flight_id,
        a.created_at AS application_created_at,
        a.updated_at AS app_updated_at,
        a.assigned_staff_id,
        c.full_name AS assigned_counselor_name,
        (SELECT p.payment_status FROM payments p WHERE p.application_id = a.id OR (u.id IS NOT NULL AND p.client_id = u.id) ORDER BY p.payment_id DESC LIMIT 1) AS payment_status,
        (SELECT p.receipt_path FROM payments p WHERE (p.application_id = a.id OR (u.id IS NOT NULL AND p.client_id = u.id)) AND p.receipt_path IS NOT NULL ORDER BY p.payment_id DESC LIMIT 1) AS receipt_path,
        (SELECT p.verified_at FROM payments p WHERE p.application_id = a.id OR (u.id IS NOT NULL AND p.client_id = u.id) ORDER BY p.payment_id DESC LIMIT 1) AS payment_verified_at,
        acc.location AS accommodation_location,
        acc.room_type AS accommodation_room_type,
        acc.floor AS accommodation_floor,
        acc.residence AS accommodation_residence,
        acc.rent AS accommodation_rent,
        f.arrival_date,
        f.arrival_time,
        f.terminal,
        f.airport,
        f.airlines,
        f.trip_number,
        f.ticket_url
      FROM applications a
      LEFT JOIN users u ON a.student_id = u.id
      LEFT JOIN students s ON u.id = s.user_id 
      LEFT JOIN users c ON a.assigned_staff_id = c.id
      LEFT JOIN accommodations acc ON a.accommodation_id = acc.id
      LEFT JOIN flights f ON a.flight_id = f.id
      ${whereSql}
      ORDER BY a.created_at DESC
    `, queryParams);
    
    res.json(clients.map(client => ({
      ...client,
      receipt_path: toPublicFilePath(client.receipt_path),
      receipt_url: toPublicFilePath(client.receipt_path)
    })));
  } catch (error) {
    console.error('Error in getAllClients:', error);
    res.status(500).json({ message: 'Server error while fetching clients', error: error.message });
  }
};

export const getMyClientProfile = async (req, res) => {
  try {
    const clientId = req.user.id;

    const [clients] = await db.query(
      `SELECT
        u.id,
        u.full_name AS name,
        u.email,
        s.passport_no,
        s.nationality,
        s.phone,
        s.country_of_residence,
        s.city,
        s.guardian_name,
        s.guardian_phone,
        s.guardian_email,
        a.id AS application_id,
        a.app_uid,
        a.university_name,
        a.program_name,
        a.qualification,
        a.study_location,
        a.study_duration_months,
        a.current_stage,
        a.status AS app_status,
        a.missing_docs_note,
        a.offer_letter_url,
        a.updated_at AS app_updated_at,
        a.assigned_staff_id,
        c.full_name AS assigned_counselor_name
       FROM users u
       LEFT JOIN students s ON u.id = s.user_id
       LEFT JOIN (
         SELECT *, ROW_NUMBER() OVER(PARTITION BY student_id ORDER BY updated_at DESC) as rn
         FROM applications
       ) a ON u.id = a.student_id AND a.rn = 1
       LEFT JOIN users c ON a.assigned_staff_id = c.id
       LEFT JOIN accommodations acc ON a.accommodation_id = acc.id
       LEFT JOIN flights f ON a.flight_id = f.id
       WHERE u.id = ? AND u.role = 'client'`,
      [clientId]
    );

    if (clients.length === 0) {
      return res.status(404).json({ message: 'Client profile not found' });
    }

    const [pendingInvoices] = await db.query(
      `SELECT COUNT(*) AS count
       FROM payments p
       LEFT JOIN applications a ON p.application_id = a.id
       WHERE COALESCE(p.client_id, a.student_id) = ?
         AND LOWER(p.payment_status) IN ('pending', 'overdue')`,
      [clientId]
    );

    const [unreadNotifications] = await db.query(
      'SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND is_read = FALSE',
      [clientId]
    );

    const [documents] = await db.query(
      `SELECT COUNT(*) AS count
       FROM documents d
       JOIN applications a ON d.application_id = a.id
       WHERE a.student_id = ?`,
      [clientId]
    );

    res.json({
      ...clients[0],
      pending_invoices_count: Number(pendingInvoices[0]?.count || 0),
      unread_messages_count: Number(unreadNotifications[0]?.count || 0),
      uploaded_documents_count: Number(documents[0]?.count || 0)
    });
  } catch (error) {
    console.error('Error in getMyClientProfile:', error);
    res.status(500).json({ message: 'Server error while fetching client profile' });
  }
};

export const registerClientApplication = async (req, res) => {
  const connection = await db.getConnection();

  try {
    await ensureClientApplicationColumns(connection);
    await ensureTaskColumns(connection);
    const {
      name,
      email,
      phone,
      nationality,
      passport_number,
      guardian_name,
      guardian_phone,
      guardian_email,
      university_name,
      program,
      qualification,
      counselor_id
    } = req.body;

    if (!name || !email || !university_name || !program || !counselor_id) {
      return res.status(400).json({ message: 'Name, email, target university, program, and assigned counselor are required' });
    }

    const existingStudentEmail = await findExistingStudentEmail(connection, email);
    if (existingStudentEmail) {
      return res.status(400).json({ error: 'user exists' });
    }

    const existingStudentPassport = await findExistingStudentPassport(connection, passport_number);
    if (existingStudentPassport) {
      return res.status(400).json({ error: 'passport exists' });
    }

    await connection.beginTransaction();

    const appUid = await generateClientApplicationUid(connection);
    const assignedCounselorId = Number(counselor_id);
    const [existingClientUsers] = await connection.query(
      "SELECT id FROM users WHERE email = ? AND role = 'client' LIMIT 1",
      [email]
    );
    const linkedClientId = existingClientUsers[0]?.id || null;

    if (linkedClientId) {
      const studentValues = [
        passport_number || null,
        nationality || null,
        phone || null,
        guardian_name || null,
        guardian_phone || null,
        guardian_email || null
      ];
      const [existingStudentRows] = await connection.query('SELECT user_id FROM students WHERE user_id = ? LIMIT 1', [linkedClientId]);

      if (existingStudentRows.length > 0) {
        await connection.query(
          `UPDATE students
           SET passport_no = ?, nationality = ?, phone = ?, guardian_name = ?, guardian_phone = ?, guardian_email = ?
           WHERE user_id = ?`,
          [...studentValues, linkedClientId]
        );
      } else {
        await connection.query(
          `INSERT INTO students (user_id, passport_no, nationality, phone, guardian_name, guardian_phone, guardian_email)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [linkedClientId, ...studentValues]
        );
      }
    }

    const [applicationResult] = await connection.query(
      `INSERT INTO applications
        (app_uid, student_id, client_id, created_by_cs_id, counselor_id, current_stage, status, university_name, program_name, qualification, assigned_staff_id, applicant_name, application_email, applicant_phone, applicant_passport_no, applicant_nationality, guardian_name, guardian_phone, guardian_email)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        appUid,
        linkedClientId,
        linkedClientId,
        req.user.id,
        assignedCounselorId,
        1,
        'DOCS_VERIFICATION',
        university_name,
        program,
        qualification || null,
        assignedCounselorId,
        name,
        email,
        phone || null,
        passport_number || null,
        nationality || null,
        guardian_name || null,
        guardian_phone || null,
        guardian_email || null
      ]
    );

    const [creatorRows] = await connection.query(
      'SELECT full_name FROM users WHERE id = ?',
      [req.user.id]
    );

    await connection.query(
      `INSERT INTO tasks (task_title, description, assigned_to, task_status, priority, application_id)
       VALUES (?, ?, ?, 'pending', 'High', ?)`,
      [
        `Review New Application: ${appUid}`,
        `A new application was assigned to you by ${creatorRows[0]?.full_name || 'Customer Service'}. Review the documents and move it to offer application when ready.`,
        assignedCounselorId,
        applicationResult.insertId
      ]
    );

    await connection.commit();

    res.status(201).json({
      message: 'Client application created successfully',
      clientId: linkedClientId,
      applicationId: applicationResult.insertId,
      application_id: applicationResult.insertId,
      app_uid: appUid
    });
  } catch (error) {
    try {
      await connection.rollback();
    } catch (rollbackError) {
      console.error('Rollback failed:', rollbackError);
    }
    console.error('Error in registerClientApplication:', error);
    res.status(500).json({ message: 'Server error while creating client application' });
  } finally {
    connection.release();
  }
};

export const getClientDocuments = async (req, res) => {
  try {
    await ensureDocumentUploaderColumn();

    const clientId = req.params.id;
    const [documents] = await db.query(
      `SELECT
        d.id,
        d.application_id,
        d.document_type,
        d.file_path,
        d.uploaded_at,
        COALESCE(
          d.uploaded_by_role,
          CASE WHEN d.document_type = 'clientUpload' THEN 'client' ELSE 'staff' END
        ) AS uploaded_by_role
       FROM documents d
       JOIN applications a ON d.application_id = a.id
       WHERE a.student_id = ? OR a.client_id = ? OR a.id = ?
       ORDER BY d.uploaded_at DESC`,
      [clientId, clientId, clientId]
    );

    res.json(documents.map(doc => ({
      ...doc,
      file_path: toPublicFilePath(doc.file_path)
    })));
  } catch (error) {
    console.error('Error in getClientDocuments:', error);
    res.status(500).json({ message: 'Server error while fetching client documents' });
  }
};

export const getMyClientDocuments = async (req, res) => {
  try {
    await ensureDocumentUploaderColumn();

    const [documents] = await db.query(
      `SELECT
        d.id,
        d.application_id,
        d.document_type,
        d.file_path,
        d.uploaded_at,
        COALESCE(
          d.uploaded_by_role,
          CASE WHEN d.document_type = 'clientUpload' THEN 'client' ELSE 'staff' END
        ) AS uploaded_by_role
       FROM documents d
       JOIN applications a ON d.application_id = a.id
       WHERE a.student_id = ?
       ORDER BY d.uploaded_at DESC`,
      [req.user.id]
    );

    res.json(documents.map(doc => ({
      ...doc,
      file_path: toPublicFilePath(doc.file_path)
    })));
  } catch (error) {
    console.error('Error in getMyClientDocuments:', error);
    res.status(500).json({ message: 'Server error while fetching your documents' });
  }
};

export const updateClient = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const clientId = req.params.id;
    const {
      name,
      full_name,
      email,
      phone,
      passport_no,
      nationality,
      guardian_name,
      guardian_phone,
      guardian_email,
      university_name,
      program_name,
      qualification,
      study_location,
      study_duration_months
    } = req.body;
    const clientName = full_name || name;

    if (!clientName || !email) {
      return res.status(400).json({ message: 'Full name and email are required' });
    }

    await connection.beginTransaction();

    const [clients] = await connection.query(
      "SELECT id FROM users WHERE id = ? AND role = 'client'",
      [clientId]
    );

    if (clients.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Client not found' });
    }

    const [emailUsers] = await connection.query(
      'SELECT id FROM users WHERE email = ? AND id <> ?',
      [email, clientId]
    );

    if (emailUsers.length > 0) {
      await connection.rollback();
      return res.status(400).json({ message: 'A user with this email already exists' });
    }

    await connection.query(
      'UPDATE users SET full_name = ?, email = ? WHERE id = ?',
      [clientName, email, clientId]
    );

    const [students] = await connection.query('SELECT user_id FROM students WHERE user_id = ?', [clientId]);

    if (students.length > 0) {
      await connection.query(
        `UPDATE students 
         SET passport_no = ?, phone = ?, nationality = ?, guardian_name = ?, guardian_phone = ?, guardian_email = ?
         WHERE user_id = ?`,
        [
          passport_no || null,
          phone || null,
          nationality || null,
          guardian_name || null,
          guardian_phone || null,
          guardian_email || null,
          clientId
        ]
      );
    } else {
      await connection.query(
        `INSERT INTO students (user_id, passport_no, phone, nationality, guardian_name, guardian_phone, guardian_email)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          clientId,
          passport_no || null,
          phone || null,
          nationality || null,
          guardian_name || null,
          guardian_phone || null,
          guardian_email || null
        ]
      );
    }

    const [applications] = await connection.query(
      'SELECT id FROM applications WHERE student_id = ? ORDER BY updated_at DESC LIMIT 1',
      [clientId]
    );

    if (applications.length > 0) {
      await connection.query(
        `UPDATE applications
         SET university_name = ?, program_name = ?, qualification = ?, study_location = ?, study_duration_months = ?
         WHERE id = ?`,
        [
          university_name || null,
          program_name || null,
          qualification || null,
          study_location || null,
          study_duration_months || null,
          applications[0].id
        ]
      );
    }

    await connection.commit();
    res.json({ message: 'Client updated successfully' });
  } catch (error) {
    await connection.rollback();
    console.error('Error in updateClient:', error);
    res.status(500).json({ message: 'Server error while updating client' });
  } finally {
    connection.release();
  }
};
