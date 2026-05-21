import db from '../config/db.js';
import { ensureDocumentUploaderColumn } from './clientController.js';
import { ensureNotificationsTable, ensureTaskColumns } from './taskController.js';
import { sendAdmissionDoneEmail, sendInvoiceReadyEmail, sendPaymentVerifiedEmail, sendVisaCompletedEmail } from '../utils/sendEmail.js';

const APPLICATION_STATUSES = [
  'LEAD',
  'PENDING_DOCS',
  'DOCS_VERIFICATION',
  'APPLIED_FOR_OL',
  'WAITING_FOR_OL',
  'PENDING_OFFER_APPLY',
  'OFFER_PROCESSING',
  'OFFER_UPLOADED',
  'OFFER_APPROVED',
  'PENDING_INVOICE_APPROVAL',
  'PENDING_PAYMENT',
  'WAITING_PAYMENT_VERIFICATION',
  'PAYMENT_VERIFIED',
  'VISA_PROCESSING',
  'VISA_COMPLETED'
];

export const generateApplicationUid = async (connection = db) => {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const appUid = `APP-${Math.floor(100000 + Math.random() * 900000)}`;
    const [rows] = await connection.query('SELECT id FROM applications WHERE app_uid = ?', [appUid]);
    if (rows.length === 0) return appUid;
  }
  return `APP-${Date.now()}`;
};

const strictStatusEnumSql = `ENUM(${APPLICATION_STATUSES.map(status => `'${status}'`).join(', ')}) DEFAULT 'LEAD'`;
const legacyApplicationStatuses = ['ACCOMMODATION_READY', 'FLIGHT_BOOKED', 'ARRIVED', 'MEDICAL_CLEARED', 'COMPLETED'];
const transitionRoles = {
  LEAD: ['Customer Service'],
  DOCS_VERIFICATION: ['Customer Service'],
  PENDING_OFFER_APPLY: ['Counselor'],
  OFFER_PROCESSING: ['Operations'],
  OFFER_UPLOADED: ['Operations'],
  OFFER_APPROVED: ['Counselor'],
  PENDING_INVOICE_APPROVAL: ['Counselor'],
  PENDING_PAYMENT: ['Finance'],
  WAITING_PAYMENT_VERIFICATION: ['Finance'],
  PAYMENT_VERIFIED: ['Finance'],
  VISA_PROCESSING: ['Operations'],
  VISA_COMPLETED: ['Counselor'],
  PENDING_DOCS: ['Counselor', 'Customer Service'],
  APPLIED_FOR_OL: ['Counselor'],
  WAITING_FOR_OL: ['Operations']
};

const roleAliases = {
  Ops: 'Operations',
  Accountant: 'Finance',
  'Financial Manager': 'Finance',
  Counselor: 'Counselor',
  'Junior Counselor': 'Counselor',
  'Senior Counselor': 'Counselor',
  'Customer Service Officer': 'Customer Service'
};

const requiredCurrentStatusByNewStatus = {
  OFFER_PROCESSING: 'PENDING_OFFER_APPLY',
  OFFER_UPLOADED: 'OFFER_PROCESSING',
  OFFER_APPROVED: 'OFFER_UPLOADED',
  VISA_PROCESSING: 'PAYMENT_VERIFIED',
  VISA_COMPLETED: 'VISA_PROCESSING'
};

const toPublicFilePath = (filePath) => {
  if (!filePath) return null;
  const normalizedPath = filePath.replace(/\\/g, '/');
  return normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`;
};

const getFirstFilePath = (files, fieldName) => {
  const file = files?.[fieldName]?.[0];
  return file ? toPublicFilePath(file.path) : null;
};

const findExistingStudentEmail = async (connection, email, excludedApplicationId = null) => {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) return null;

  const [userRows] = await connection.query(
    'SELECT id, email FROM users WHERE LOWER(email) = ? LIMIT 1',
    [normalizedEmail]
  );
  if (userRows.length > 0) return { source: 'users', id: userRows[0].id };

  const params = [normalizedEmail];
  let excludedSql = '';
  if (excludedApplicationId) {
    excludedSql = 'AND id <> ?';
    params.push(excludedApplicationId);
  }

  const [applicationRows] = await connection.query(
    `SELECT id, app_uid
     FROM applications
     WHERE LOWER(application_email) = ?
       ${excludedSql}
     LIMIT 1`,
    params
  );

  return applicationRows[0] ? { source: 'applications', id: applicationRows[0].id } : null;
};

const findExistingStudentPassport = async (connection, passportNo, excludedApplicationId = null) => {
  const normalizedPassport = String(passportNo || '').trim().toLowerCase();
  if (!normalizedPassport) return null;

  const [studentRows] = await connection.query(
    'SELECT id, user_id FROM students WHERE LOWER(passport_no) = ? LIMIT 1',
    [normalizedPassport]
  );
  if (studentRows.length > 0) return { source: 'students', id: studentRows[0].id };

  const params = [normalizedPassport];
  let excludedSql = '';
  if (excludedApplicationId) {
    excludedSql = 'AND id <> ?';
    params.push(excludedApplicationId);
  }

  const [applicationRows] = await connection.query(
    `SELECT id, app_uid
     FROM applications
     WHERE LOWER(applicant_passport_no) = ?
       ${excludedSql}
     LIMIT 1`,
    params
  );

  return applicationRows[0] ? { source: 'applications', id: applicationRows[0].id } : null;
};

const hasUpload = (files, fieldName) => Boolean(files?.[fieldName]?.[0]);

const normalizeDepartment = (user) => (
  roleAliases[user?.department] ||
  roleAliases[user?.job_title] ||
  user?.department ||
  user?.job_title ||
  ''
);

const createCounselorApplicationTask = async (connection, { applicationId, appUid, counselorId, createdByName }) => {
  if (!applicationId || !counselorId) return;

  await ensureTaskColumns(connection);
  await ensureNotificationsTable(connection);
  await connection.query(
    `INSERT INTO tasks (task_title, description, assigned_to, task_status, priority, application_id)
     VALUES (?, ?, ?, 'pending', 'High', ?)`,
    [
      `Review New Application: ${appUid}`,
      createdByName
        ? `A new application was assigned to you by ${createdByName}. Review the documents and move it to offer application when ready.`
        : 'A new application was assigned to you. Review the documents and move it to offer application when ready.',
      counselorId,
      applicationId
    ]
  );
  await connection.query(
    `INSERT INTO notifications (user_id, message, type, application_id, app_uid, target_url, is_read)
     VALUES (?, ?, ?, ?, ?, ?, FALSE)`,
    [
      counselorId,
      `New application assigned to you: ${appUid}`,
      'application_assignment',
      applicationId,
      appUid,
      `/staff/clients?openApp=${appUid}`
    ]
  );
};

const safeAlter = async (connection, statement, allowedCodes = ['ER_DUP_FIELDNAME']) => {
  try {
    await connection.query(statement);
  } catch (error) {
    if (!allowedCodes.includes(error.code)) {
      throw error;
    }
  }
};

const ensureConstraint = async (connection, databaseName, constraintName, statement) => {
  const [rows] = await connection.query(
    `SELECT CONSTRAINT_NAME
     FROM information_schema.TABLE_CONSTRAINTS
     WHERE CONSTRAINT_SCHEMA = ? AND TABLE_NAME = 'applications' AND CONSTRAINT_NAME = ?`,
    [databaseName, constraintName]
  );

  if (rows.length === 0) {
    await safeAlter(connection, statement, ['ER_DUP_KEYNAME']);
  }
};

export const ensureApplicationLifecycleSchema = async (connection = db) => {
  const [[databaseRow]] = await connection.query('SELECT DATABASE() AS database_name');
  const databaseName = databaseRow.database_name;

  const columnStatements = [
    'ALTER TABLE applications ADD COLUMN app_uid VARCHAR(50) NULL',
    'ALTER TABLE applications ADD COLUMN client_id INT DEFAULT NULL',
    'ALTER TABLE applications ADD COLUMN created_by_cs_id INT DEFAULT NULL',
    'ALTER TABLE applications ADD COLUMN counselor_id INT DEFAULT NULL',
    'ALTER TABLE applications ADD COLUMN ops_id INT DEFAULT NULL',
    'ALTER TABLE applications ADD COLUMN visa_progress INT DEFAULT 0',
    'ALTER TABLE applications ADD COLUMN offer_letter_url VARCHAR(255) DEFAULT NULL',
    'ALTER TABLE applications ADD COLUMN accommodation_id INT DEFAULT NULL',
    'ALTER TABLE applications ADD COLUMN flight_id INT DEFAULT NULL'
    ,'ALTER TABLE applications ADD COLUMN applicant_name VARCHAR(255) DEFAULT NULL'
    ,'ALTER TABLE applications ADD COLUMN application_email VARCHAR(255) DEFAULT NULL'
    ,'ALTER TABLE applications ADD COLUMN applicant_phone VARCHAR(50) DEFAULT NULL'
    ,'ALTER TABLE applications ADD COLUMN applicant_passport_no VARCHAR(100) DEFAULT NULL'
    ,'ALTER TABLE applications ADD COLUMN applicant_nationality VARCHAR(100) DEFAULT NULL'
    ,'ALTER TABLE applications ADD COLUMN applicant_country_of_residence VARCHAR(100) DEFAULT NULL'
    ,'ALTER TABLE applications ADD COLUMN applicant_city VARCHAR(100) DEFAULT NULL'
    ,'ALTER TABLE applications ADD COLUMN guardian_name VARCHAR(255) DEFAULT NULL'
    ,'ALTER TABLE applications ADD COLUMN guardian_phone VARCHAR(50) DEFAULT NULL'
    ,'ALTER TABLE applications ADD COLUMN guardian_email VARCHAR(255) DEFAULT NULL'
    ,'ALTER TABLE applications ADD COLUMN missing_docs_note TEXT DEFAULT NULL'
  ];

  for (const statement of columnStatements) {
    await safeAlter(connection, statement);
  }

  await safeAlter(connection, 'ALTER TABLE applications MODIFY student_id INT NULL', []);
  await connection.query('UPDATE applications SET client_id = student_id WHERE client_id IS NULL AND student_id IS NOT NULL');
  const [missingUidRows] = await connection.query('SELECT id FROM applications WHERE app_uid IS NULL OR app_uid = ""');
  for (const row of missingUidRows) {
    await connection.query('UPDATE applications SET app_uid = ? WHERE id = ?', [await generateApplicationUid(connection), row.id]);
  }
  await safeAlter(connection, 'ALTER TABLE applications ADD UNIQUE KEY uq_applications_app_uid (app_uid)', ['ER_DUP_KEYNAME']);
  await safeAlter(connection, 'ALTER TABLE applications MODIFY app_uid VARCHAR(50) NOT NULL', []);
  await safeAlter(
    connection,
    `ALTER TABLE applications MODIFY status ENUM('pending', 'approved', 'rejected', ${APPLICATION_STATUSES.concat(legacyApplicationStatuses).map(status => `'${status}'`).join(', ')}) DEFAULT 'LEAD'`,
    []
  );
  await connection.query(
    `UPDATE applications
     SET status = CASE
       WHEN status IN ('approved', 'ACCOMMODATION_READY', 'FLIGHT_BOOKED', 'ARRIVED', 'MEDICAL_CLEARED', 'COMPLETED') THEN 'VISA_COMPLETED'
       WHEN status = 'rejected' THEN 'LEAD'
       WHEN status = 'pending' THEN 'LEAD'
       ELSE status
     END`
  );
  await safeAlter(connection, `ALTER TABLE applications MODIFY status ${strictStatusEnumSql}`, []);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS accommodations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      application_id INT NOT NULL,
      location VARCHAR(255),
      room_type VARCHAR(100),
      floor VARCHAR(50),
      residence VARCHAR(255),
      rent DECIMAL(10, 2),
      images_urls JSON,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
    )
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS flights (
      id INT AUTO_INCREMENT PRIMARY KEY,
      application_id INT NOT NULL,
      arrival_date DATE,
      arrival_time TIME,
      terminal VARCHAR(100),
      airport VARCHAR(255),
      airlines VARCHAR(255),
      trip_number VARCHAR(100),
      ticket_url VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
    )
  `);

  await ensureConstraint(
    connection,
    databaseName,
    'fk_applications_client',
    'ALTER TABLE applications ADD CONSTRAINT fk_applications_client FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE'
  );
  await ensureConstraint(
    connection,
    databaseName,
    'fk_applications_created_by_cs',
    'ALTER TABLE applications ADD CONSTRAINT fk_applications_created_by_cs FOREIGN KEY (created_by_cs_id) REFERENCES users(id) ON DELETE SET NULL'
  );
  await ensureConstraint(
    connection,
    databaseName,
    'fk_applications_counselor',
    'ALTER TABLE applications ADD CONSTRAINT fk_applications_counselor FOREIGN KEY (counselor_id) REFERENCES users(id) ON DELETE SET NULL'
  );
  await ensureConstraint(
    connection,
    databaseName,
    'fk_applications_ops',
    'ALTER TABLE applications ADD CONSTRAINT fk_applications_ops FOREIGN KEY (ops_id) REFERENCES users(id) ON DELETE SET NULL'
  );
  await ensureConstraint(
    connection,
    databaseName,
    'fk_applications_accommodation',
    'ALTER TABLE applications ADD CONSTRAINT fk_applications_accommodation FOREIGN KEY (accommodation_id) REFERENCES accommodations(id) ON DELETE SET NULL'
  );
  await ensureConstraint(
    connection,
    databaseName,
    'fk_applications_flight',
    'ALTER TABLE applications ADD CONSTRAINT fk_applications_flight FOREIGN KEY (flight_id) REFERENCES flights(id) ON DELETE SET NULL'
  );
};

// @desc    Start a new application
// @route   POST /api/applications
// @access  Private/Client/Staff/Admin
export const createApplication = async (req, res) => {
  const connection = await db.getConnection();

  try {
    await ensureApplicationLifecycleSchema(connection);
    await ensureTaskColumns(connection);

    if (req.user.role === 'staff' || req.user.role === 'admin') {
      const {
        full_name,
        nationality,
        passport_number,
        phone,
        email,
        country_of_residence,
        city,
        university_name,
        study_program,
        qualification,
        study_location,
        duration_months,
        guardian_name,
        guardian_phone,
        guardian_email,
        counselor_id
      } = req.body;

      if (!full_name || !email || !university_name || !study_program) {
        return res.status(400).json({ message: 'Full name, email, university, and study program are required' });
      }

      const existingStudentEmail = await findExistingStudentEmail(connection, email);
      if (existingStudentEmail) {
        return res.status(400).json({ error: 'user exists' });
      }

      const existingStudentPassport = await findExistingStudentPassport(connection, passport_number);
      if (existingStudentPassport) {
        return res.status(400).json({ error: 'passport exists' });
      }

      const [actorRows] = await connection.query(
        'SELECT id, role, department, job_title, full_name FROM users WHERE id = ?',
        [req.user.id]
      );
      const actor = actorRows[0] || req.user;
      const actorDepartment = normalizeDepartment(actor);
      const assignedCounselorId = actorDepartment === 'Counselor' ? Number(req.user.id) : Number(counselor_id);

      if (!assignedCounselorId) {
        return res.status(400).json({ message: 'A counselor assignment is required' });
      }

      await connection.beginTransaction();

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
          country_of_residence || null,
          city || null,
          guardian_name || null,
          guardian_phone || null,
          guardian_email || null
        ];
        const [existingStudentRows] = await connection.query('SELECT user_id FROM students WHERE user_id = ? LIMIT 1', [linkedClientId]);

        if (existingStudentRows.length > 0) {
          await connection.query(
            `UPDATE students
             SET passport_no = ?, nationality = ?, phone = ?, country_of_residence = ?, city = ?, guardian_name = ?, guardian_phone = ?, guardian_email = ?
             WHERE user_id = ?`,
            [...studentValues, linkedClientId]
          );
        } else {
          await connection.query(
            `INSERT INTO students
              (user_id, passport_no, nationality, phone, country_of_residence, city, guardian_name, guardian_phone, guardian_email)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [linkedClientId, ...studentValues]
          );
        }
      }

      const appUid = await generateApplicationUid(connection);
      const [applicationResult] = await connection.query(
        `INSERT INTO applications
          (app_uid, student_id, client_id, created_by_cs_id, counselor_id, current_stage, status, university_name, program_name, study_location, qualification, study_duration_months, assigned_staff_id, applicant_name, application_email, applicant_phone, applicant_passport_no, applicant_nationality, applicant_country_of_residence, applicant_city, guardian_name, guardian_phone, guardian_email)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          appUid,
          linkedClientId,
          linkedClientId,
          req.user.id,
          assignedCounselorId,
          1,
          'DOCS_VERIFICATION',
          university_name,
          study_program,
          study_location || null,
          qualification || null,
          duration_months || null,
          assignedCounselorId,
          full_name,
          email,
          phone || null,
          passport_number || null,
          nationality || null,
          country_of_residence || null,
          city || null,
          guardian_name || null,
          guardian_phone || null,
          guardian_email || null
        ]
      );

      await createCounselorApplicationTask(connection, {
        applicationId: applicationResult.insertId,
        appUid,
        counselorId: assignedCounselorId,
        createdByName: actor?.full_name || 'Staff'
      });

      await connection.commit();

      return res.status(201).json({
        message: 'Application created successfully',
        application_id: applicationResult.insertId,
        applicationId: applicationResult.insertId,
        app_uid: appUid
      });
    }

    const { university_name, program_name } = req.body;
    
    if (!university_name || !program_name) {
      return res.status(400).json({ message: 'University name and program name are required' });
    }

    const appUid = await generateApplicationUid();
    const [result] = await db.query(
      'INSERT INTO applications (app_uid, student_id, client_id, current_stage, status, university_name, program_name, applicant_name, application_email) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [appUid, req.user.id, req.user.id, 1, 'LEAD', university_name, program_name, req.user.full_name || null, req.user.email || null]
    );

    res.status(201).json({
      message: 'Application created successfully',
      applicationId: result.insertId,
      application_id: result.insertId,
      app_uid: appUid
    });
  } catch (error) {
    try {
      await connection.rollback();
    } catch (rollbackError) {
      console.error('Rollback failed:', rollbackError);
    }
    console.error('Error in createApplication:', error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    connection.release();
  }
};

// @desc    Get logged in client's application
// @route   GET /api/applications/my-application
// @access  Private/Client
export const getStudentApplication = async (req, res) => {
  try {
    await ensureApplicationLifecycleSchema();

    const [applications] = await db.query(
      'SELECT * FROM applications WHERE student_id = ? ORDER BY created_at DESC',
      [req.user.id]
    );

    res.json(applications);
  } catch (error) {
    console.error('Error in getStudentApplication:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get all applications
// @route   GET /api/applications
// @access  Private/Staff,Admin
export const getAllApplications = async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized: User role not found in request.' });
    }

    await ensureApplicationLifecycleSchema();

    const [requestingUsers] = await db.query(
      'SELECT role, department, job_title FROM users WHERE id = ?',
      [req.user.id]
    );
    if (requestingUsers.length === 0) {
      return res.status(401).json({ error: 'Unauthorized: User role not found in request.' });
    }

    const requester = requestingUsers[0];
    if (!requester.department && requester.role !== 'admin') {
      return res.status(401).json({ error: 'Unauthorized: User role not found in request.' });
    }

    const requesterDepartment = normalizeDepartment(requester);
    const whereClauses = [];
    const queryParams = [];

    if (requester.role !== 'admin') {
      if (requesterDepartment === 'Customer Service') {
        whereClauses.push('applications.created_by_cs_id = ?');
        queryParams.push(req.user.id);
      } else if (requesterDepartment === 'Counselor') {
        whereClauses.push('(applications.counselor_id = ? OR applications.assigned_staff_id = ? OR applications.created_by_cs_id = ?)');
        queryParams.push(req.user.id, req.user.id, req.user.id);
      }
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const [applications] = await db.query(
      `SELECT
              applications.id AS app_id,
              applications.id AS id,
              applications.app_uid,
              applications.student_id,
              applications.client_id,
              applications.created_by_cs_id,
              applications.counselor_id,
              applications.ops_id,
              applications.current_stage,
              applications.status,
              applications.missing_docs_note,
              applications.university_name,
              applications.program_name,
              applications.study_location,
              applications.qualification,
              applications.study_duration_months,
              applications.assigned_staff_id,
              applications.visa_progress,
              applications.offer_letter_url,
              applications.accommodation_id,
              applications.flight_id,
              applications.created_at,
              applications.updated_at,
              COALESCE(student_user.full_name, applications.applicant_name) as student_name,
              COALESCE(student_user.email, applications.application_email) as student_email,
              assigned_user.full_name as assigned_staff_name,
              (SELECT payments.payment_status FROM payments WHERE payments.application_id = applications.id ORDER BY payments.payment_id DESC LIMIT 1) AS payment_status,
              (SELECT payments.receipt_path FROM payments WHERE payments.application_id = applications.id ORDER BY payments.payment_id DESC LIMIT 1) AS receipt_path,
              (SELECT payments.verified_at FROM payments WHERE payments.application_id = applications.id ORDER BY payments.payment_id DESC LIMIT 1) AS payment_verified_at,
              accommodations.location AS accommodation_location,
              accommodations.room_type AS accommodation_room_type,
              accommodations.floor AS accommodation_floor,
              accommodations.residence AS accommodation_residence,
              accommodations.rent AS accommodation_rent,
              flights.arrival_date,
              flights.arrival_time,
              flights.terminal,
              flights.airport,
              flights.airlines,
              flights.trip_number,
              flights.ticket_url
       FROM applications
       LEFT JOIN users student_user ON applications.student_id = student_user.id
       LEFT JOIN users assigned_user ON applications.assigned_staff_id = assigned_user.id
       LEFT JOIN accommodations ON applications.accommodation_id = accommodations.id
       LEFT JOIN flights ON applications.flight_id = flights.id
       ${whereSql}
       ORDER BY applications.created_at DESC`,
      queryParams
    );

    res.status(200).json(applications);
  } catch (error) {
    console.error('API GET Applications Error:', error);
    res.status(500).json({
      message: 'Server error while fetching applications',
      error: error.message
    });
  }
};

// @desc    Update an application's stage
// @route   PUT /api/applications/:id/stage
// @access  Private/Staff,Admin
export const updateApplicationStage = async (req, res) => {
  try {
    await ensureApplicationLifecycleSchema();

    const { current_stage, status } = req.body;
    const applicationId = req.params.id;
    const legacyStatusMap = {
      pending: 'LEAD',
      approved: 'VISA_COMPLETED',
      rejected: 'LEAD'
    };
    const nextStatus = legacyStatusMap[status] || status;

    if (!current_stage) {
      return res.status(400).json({ message: 'Current stage is required' });
    }

    let updateQuery = 'UPDATE applications SET current_stage = ? WHERE id = ?';
    let updateParams = [current_stage, applicationId];

    if (nextStatus) {
      if (!APPLICATION_STATUSES.includes(nextStatus)) {
        return res.status(400).json({ message: 'Invalid application status' });
      }
      updateQuery = 'UPDATE applications SET current_stage = ?, status = ? WHERE id = ?';
      updateParams = [current_stage, nextStatus, applicationId];
    }

    const [result] = await db.query(updateQuery, updateParams);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Application not found' });
    }

    res.json({ message: 'Application updated successfully' });
  } catch (error) {
    console.error('Error in updateApplicationStage:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update visa progress for an application
// @route   PUT /api/applications/:id/visa-progress
// @access  Private/Counselor
export const updateVisaProgress = async (req, res) => {
  try {
    await ensureApplicationLifecycleSchema();

    const applicationId = req.params.id;
    const visaProgress = Math.max(0, Math.min(100, Number(req.body.visa_progress)));

    if (Number.isNaN(visaProgress)) {
      return res.status(400).json({ message: 'visa_progress must be a number from 0 to 100' });
    }

    const [actorRows] = await db.query(
      'SELECT id, role, department, job_title FROM users WHERE id = ?',
      [req.user.id]
    );
    const actorDepartment = normalizeDepartment(actorRows[0]);

    if (actorDepartment !== 'Counselor') {
      return res.status(403).json({ message: 'Only Counselor staff can update visa progress' });
    }

    const [result] = await db.query(
      "UPDATE applications SET visa_progress = ? WHERE id = ? AND status = 'VISA_PROCESSING'",
      [visaProgress, applicationId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Visa-processing application not found' });
    }

    const [applications] = await db.query('SELECT * FROM applications WHERE id = ?', [applicationId]);
    res.json({ message: 'Visa progress updated', application: applications[0] });
  } catch (error) {
    console.error('Error in updateVisaProgress:', error);
    res.status(500).json({ message: 'Server error while updating visa progress' });
  }
};

// @desc    Assign an application to a staff member
// @route   PATCH /api/applications/:id/assign
// @access  Private/Admin
export const assignApplication = async (req, res) => {
  try {
    await ensureApplicationLifecycleSchema();

    const { assigned_staff_id } = req.body;
    const applicationId = req.params.id;

    if (!assigned_staff_id) {
      return res.status(400).json({ message: 'assigned_staff_id is required' });
    }

    const [result] = await db.query(
      'UPDATE applications SET assigned_staff_id = ? WHERE id = ?',
      [assigned_staff_id, applicationId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Application not found' });
    }

    res.json({ message: 'Application assigned successfully' });
  } catch (error) {
    console.error('Error in assignApplication:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Advance an application through the lifecycle state machine
// @route   PUT /api/applications/:id/advance-state
// @access  Private/Staff,Admin
export const advanceApplicationState = async (req, res) => {
  const connection = await db.getConnection();

  try {
    await ensureApplicationLifecycleSchema(connection);
    await ensureTaskColumns(connection);

    const applicationId = req.params.id;
    const { new_status } = req.body;
    const files = req.files || {};

    if (!APPLICATION_STATUSES.includes(new_status)) {
      return res.status(400).json({
        message: 'Invalid application status',
        allowed_statuses: APPLICATION_STATUSES
      });
    }

    const [actorRows] = await connection.query(
      'SELECT id, role, department, job_title FROM users WHERE id = ?',
      [req.user.id]
    );

    if (actorRows.length === 0) {
      return res.status(401).json({ message: 'Authenticated user was not found' });
    }

    const actor = actorRows[0];
    const requiredDepartments = transitionRoles[new_status] || [];
    const actorDepartment = normalizeDepartment(actor);
    const isAuthorized = requiredDepartments.includes(actorDepartment);

    if (!isAuthorized) {
      return res.status(403).json({
        message: `${new_status} can only be set by ${requiredDepartments.join(' or ') || 'an authorized department'}`
      });
    }

    const [applicationRows] = await connection.query(
      'SELECT id, app_uid, student_id, status, visa_progress, accommodation_id, applicant_name, counselor_id, assigned_staff_id FROM applications WHERE id = ?',
      [applicationId]
    );

    if (applicationRows.length === 0) {
      return res.status(404).json({ message: 'Application not found' });
    }

    const application = applicationRows[0];
    const requiredCurrentStatus = requiredCurrentStatusByNewStatus[new_status];

    if (application.status === 'VISA_COMPLETED' && new_status !== 'VISA_COMPLETED') {
      return res.status(400).json({
        message: 'This application is already at the final stage: Visa Completed.'
      });
    }

    if (requiredCurrentStatus && application.status !== requiredCurrentStatus) {
      return res.status(400).json({
        message: `${new_status} requires the application to currently be ${requiredCurrentStatus}`
      });
    }

    if (new_status === 'OFFER_UPLOADED' && !hasUpload(files, 'offer_letter')) {
      return res.status(400).json({ message: 'Offer letter file is required' });
    }

    if (new_status === 'VISA_PROCESSING' && !hasUpload(files, 'visa_document')) {
      return res.status(400).json({ message: 'Visa document file is required' });
    }

    await connection.beginTransaction();

    const updateFields = ['status = ?'];
    const updateValues = [new_status];

    if (actorDepartment === 'Customer Service') {
      updateFields.push('created_by_cs_id = COALESCE(created_by_cs_id, ?)');
      updateValues.push(actor.id);
    }

    if (actorDepartment === 'Counselor') {
      updateFields.push('counselor_id = ?');
      updateValues.push(actor.id);
    }

    if (actorDepartment === 'Operations') {
      updateFields.push('ops_id = ?');
      updateValues.push(actor.id);
    }

    if (new_status === 'VISA_PROCESSING' && req.body.visa_progress === undefined) {
      updateFields.push('visa_progress = GREATEST(visa_progress, 1)');
    }

    if (new_status === 'PENDING_DOCS') {
      updateFields.push('missing_docs_note = ?');
      updateValues.push(req.body.missing_docs_note || null);
    }

    if (new_status === 'PAYMENT_VERIFIED') {
      await connection.query(
        `UPDATE payments
         SET payment_status = 'Paid',
             payment_date = COALESCE(payment_date, CURDATE()),
             verified_at = CURRENT_TIMESTAMP
         WHERE application_id = ?`,
        [applicationId]
      );
    }

    const offerLetterUrl = getFirstFilePath(files, 'offer_letter');
    if (new_status === 'OFFER_UPLOADED' && offerLetterUrl) {
      updateFields.push('offer_letter_url = ?');
      updateValues.push(offerLetterUrl);
    }

    if (new_status === 'VISA_PROCESSING' && req.body.visa_progress !== undefined) {
      updateFields.push('visa_progress = ?');
      updateValues.push(Math.max(0, Math.min(100, Number(req.body.visa_progress) || 0)));
    }

    const visaDocumentUrl = getFirstFilePath(files, 'visa_document');
    if (new_status === 'VISA_PROCESSING' && visaDocumentUrl) {
      await ensureDocumentUploaderColumn();
      await connection.query(
        'INSERT INTO documents (application_id, document_type, file_path, uploaded_by_role) VALUES (?, ?, ?, ?)',
        [applicationId, 'Visa Document', visaDocumentUrl, actor.role === 'admin' ? 'admin' : 'staff']
      );
    }

    updateValues.push(applicationId);
    await connection.query(
      `UPDATE applications SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    if (actorDepartment === 'Counselor' && new_status === 'PENDING_OFFER_APPLY') {
      const [taskUpdateResult] = await connection.query(
        `UPDATE tasks
         SET task_status = 'completed'
         WHERE application_id = ?
           AND assigned_to = ?
           AND task_title LIKE 'Review New Application:%'
           AND task_status <> 'completed'`,
        [applicationId, actor.id]
      );

      if (taskUpdateResult.affectedRows === 0) {
        const [taskApplicationRows] = await connection.query(
          'SELECT app_uid FROM applications WHERE id = ?',
          [applicationId]
        );
        await connection.query(
          `INSERT INTO tasks (task_title, description, assigned_to, task_status, priority, application_id)
           VALUES (?, ?, ?, 'completed', 'High', ?)`,
          [
            `Review New Application: ${taskApplicationRows[0]?.app_uid || applicationId}`,
            'Auto-recorded when the counselor approved the assigned application documents.',
            actor.id,
            applicationId
          ]
        );
      }

      await ensureNotificationsTable(connection);
      const [operationsStaff] = await connection.query(
        "SELECT id FROM users WHERE role = 'staff' AND (department = 'Operations' OR job_title LIKE '%Operations%')"
      );

      for (const staff of operationsStaff) {
        await connection.query(
          `INSERT INTO notifications (user_id, message, type, application_id, app_uid, target_url, is_read)
           VALUES (?, ?, ?, ?, ?, ?, FALSE)`,
          [
            staff.id,
            `Offer letter requested for ${application.app_uid || `application #${applicationId}`}. Please begin processing.`,
            'offer_letter_request',
            applicationId,
            application.app_uid,
            application.app_uid ? `/staff/clients?openApp=${application.app_uid}` : '/staff/clients'
          ]
        );
      }
    }

    if (actorDepartment === 'Operations' && new_status === 'VISA_PROCESSING') {
      const counselorId = application.counselor_id || application.assigned_staff_id;
      if (counselorId) {
        await ensureNotificationsTable(connection);
        await connection.query(
          `INSERT INTO notifications (user_id, message, type, application_id, app_uid, target_url, is_read)
           VALUES (?, ?, ?, ?, ?, ?, FALSE)`,
          [
            counselorId,
            `Visa applied for ${application.app_uid || `application #${applicationId}`}.`,
            'visa_applied',
            applicationId,
            application.app_uid,
            application.app_uid ? `/staff/clients?openApp=${application.app_uid}` : '/staff/clients'
          ]
        );
      }
    }

    const [updatedRows] = await connection.query(
      `SELECT
        a.*,
        COALESCE(u.full_name, a.applicant_name) AS student_name,
        COALESCE(u.email, a.application_email) AS student_email,
        accommodation.location AS accommodation_location,
        accommodation.room_type AS accommodation_room_type,
        accommodation.floor AS accommodation_floor,
        accommodation.residence AS accommodation_residence,
        accommodation.rent AS accommodation_rent,
        accommodation.images_urls AS accommodation_images_urls,
        flight.arrival_date,
        flight.arrival_time,
        flight.terminal,
        flight.airport,
        flight.airlines,
        flight.trip_number,
        flight.ticket_url
       FROM applications a
       LEFT JOIN users u ON a.student_id = u.id
       LEFT JOIN accommodations accommodation ON a.accommodation_id = accommodation.id
       LEFT JOIN flights flight ON a.flight_id = flight.id
       WHERE a.id = ?`,
      [applicationId]
    );

    await connection.commit();

    const updatedApplication = updatedRows[0];
    const emailTriggers = {
      OFFER_APPROVED: sendAdmissionDoneEmail,
      PENDING_PAYMENT: sendInvoiceReadyEmail,
      PAYMENT_VERIFIED: sendPaymentVerifiedEmail,
      VISA_COMPLETED: sendVisaCompletedEmail
    };
    const sendLifecycleEmail = emailTriggers[new_status];

    if (sendLifecycleEmail && updatedApplication?.student_email) {
      try {
        await sendLifecycleEmail(updatedApplication.student_email, updatedApplication.student_name);
      } catch (emailError) {
        console.error(`Application advanced to ${new_status}, but lifecycle email failed:`, emailError);
      }
    }

    res.json({
      message: `Application advanced to ${new_status}`,
      application: updatedApplication
    });
  } catch (error) {
    try {
      await connection.rollback();
    } catch (rollbackError) {
      console.error('Rollback failed:', rollbackError);
    }
    console.error('Error in advanceApplicationState:', error);
    res.status(500).json({ message: 'Server error while advancing application state' });
  } finally {
    connection.release();
  }
};

// @desc    Notify client that documents are missing for an application
// @route   POST /api/applications/:id/missing-documents
// @access  Private/Staff,Admin
export const requestMissingDocuments = async (req, res) => {
  try {
    await ensureApplicationLifecycleSchema();

    const applicationId = req.params.id;
    const [actorRows] = await db.query(
      'SELECT id, role, department, job_title FROM users WHERE id = ?',
      [req.user.id]
    );
    const actor = actorRows[0];
    const actorDepartment = normalizeDepartment(actor);

    if (actor?.role !== 'admin' && actorDepartment !== 'Counselor') {
      return res.status(403).json({ message: 'Only counselors or admins can request missing documents' });
    }

    const [applications] = await db.query(
      `SELECT
        a.id,
        a.app_uid,
        a.student_id,
        a.counselor_id,
        student.full_name AS student_name
       FROM applications a
       JOIN users student ON a.student_id = student.id
       WHERE a.id = ?`,
      [applicationId]
    );

    if (applications.length === 0) {
      return res.status(404).json({ message: 'Application not found' });
    }

    const application = applications[0];
    if (actor?.role !== 'admin' && Number(application.counselor_id) !== Number(req.user.id)) {
      return res.status(403).json({ message: 'You can only request documents for applications assigned to you' });
    }

    const missingDocsNote = req.body.missing_docs_note || 'Please upload the missing documents requested by your counselor.';
    await ensureNotificationsTable();

    await db.query(
      "UPDATE applications SET status = 'PENDING_DOCS', missing_docs_note = ? WHERE id = ?",
      [missingDocsNote, application.id]
    );

    await db.query(
      `INSERT INTO notifications (user_id, message, type, application_id, app_uid, target_url, is_read)
       VALUES (?, ?, 'missing_documents', ?, ?, ?, FALSE)`,
      [
        application.student_id,
        `Your counselor marked documents as missing for ${application.app_uid}. Please upload the required documents.`,
        application.id,
        application.app_uid,
        '/client'
      ]
    );

    const [admins] = await db.query("SELECT id FROM users WHERE role = 'admin'");
    for (const admin of admins) {
      await db.query(
        `INSERT INTO notifications (user_id, message, type, application_id, app_uid, target_url, is_read)
         VALUES (?, ?, 'missing_documents', ?, ?, ?, FALSE)`,
        [
          admin.id,
          `Missing documents requested for ${application.app_uid}.`,
          application.id,
          application.app_uid,
          `/admin/clients?openApp=${encodeURIComponent(application.app_uid)}`
        ]
      );
    }

    res.json({
      message: 'Missing documents request sent to the client',
      application_id: application.id,
      app_uid: application.app_uid
    });
  } catch (error) {
    console.error('Error in requestMissingDocuments:', error);
    res.status(500).json({ message: 'Server error while requesting missing documents', error: error.message });
  }
};

// @desc    Get dashboard KPIs
// @route   GET /api/applications/kpis
// @access  Private/Admin/Staff
export const getDashboardKPIs = async (req, res) => {
  try {
    await ensureApplicationLifecycleSchema();

    const [totalUsers] = await db.query("SELECT role, COUNT(*) as count FROM users GROUP BY role");
    const [statusData] = await db.query("SELECT status, COUNT(*) as count FROM applications GROUP BY status");
    const [stageData] = await db.query("SELECT current_stage, COUNT(*) as count FROM applications GROUP BY current_stage");
    
    res.json({
      users: totalUsers,
      status: statusData,
      stages: stageData,
      total_applications: statusData.reduce((acc, curr) => acc + parseInt(curr.count), 0)
    });
  } catch (error) {
    console.error('Error fetching KPIs:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get applications assigned to logged in staff
// @route   GET /api/applications/assigned
// @access  Private/Staff
export const getAssignedApplications = async (req, res) => {
  try {
    await ensureApplicationLifecycleSchema();

    const [applications] = await db.query(
      `SELECT a.*, COALESCE(u.full_name, a.applicant_name) as student_name, COALESCE(u.email, a.application_email) as student_email,
              (SELECT p.payment_status FROM payments p WHERE p.application_id = a.id ORDER BY p.payment_id DESC LIMIT 1) AS payment_status,
              (SELECT p.receipt_path FROM payments p WHERE p.application_id = a.id ORDER BY p.payment_id DESC LIMIT 1) AS receipt_path,
              (SELECT p.verified_at FROM payments p WHERE p.application_id = a.id ORDER BY p.payment_id DESC LIMIT 1) AS payment_verified_at,
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
       LEFT JOIN accommodations acc ON a.accommodation_id = acc.id
       LEFT JOIN flights f ON a.flight_id = f.id
       WHERE a.assigned_staff_id = ? 
       ORDER BY a.created_at DESC`,
      [req.user.id]
    );

    res.json(applications);
  } catch (error) {
    console.error('Error in getAssignedApplications:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Staff creating new comprehensive application
// @route   POST /api/applications/new
// @access  Private/Staff,Admin
export const createNewApplication = async (req, res) => {
  const connection = await db.getConnection(); 
  try {
    await ensureApplicationLifecycleSchema(connection);
    await connection.beginTransaction();

    const {
      firstName, lastName, nationality, passportNo, phone, email, country, city,
      universityName, studyProgram, studyLocation, qualification, studyDuration,
      guardianName, guardianPhone, guardianEmail
    } = req.body;

    const files = req.files || {};

    if (!email || !firstName || !universityName) {
      await connection.rollback();
      return res.status(400).json({ message: 'Missing required fields.' });
    }

    let studentUserId = null;
    const fullName = `${firstName} ${lastName}`.trim();
    const existingStudentEmail = await findExistingStudentEmail(connection, email);
    if (existingStudentEmail) {
      await connection.rollback();
      return res.status(400).json({ error: 'user exists' });
    }

    const existingStudentPassport = await findExistingStudentPassport(connection, passportNo);
    if (existingStudentPassport) {
      await connection.rollback();
      return res.status(400).json({ error: 'passport exists' });
    }

    if (studentUserId) {
      const [existingStudent] = await connection.query('SELECT id FROM students WHERE user_id = ?', [studentUserId]);
      if (existingStudent.length === 0) {
        await connection.query(
          `INSERT INTO students (user_id, passport_no, nationality, phone, country_of_residence, city, guardian_name, guardian_phone, guardian_email)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [studentUserId, passportNo, nationality, phone, country, city, guardianName, guardianPhone, guardianEmail]
        );
      } else {
        await connection.query(
          `UPDATE students SET passport_no=?, nationality=?, phone=?, country_of_residence=?, city=?, guardian_name=?, guardian_phone=?, guardian_email=? WHERE user_id=?`,
          [passportNo, nationality, phone, country, city, guardianName, guardianPhone, guardianEmail, studentUserId]
        );
      }
    }

    const staffId = req.user.id;
    const appUid = await generateApplicationUid(connection);
    const [appResult] = await connection.query(
      `INSERT INTO applications (app_uid, student_id, client_id, created_by_cs_id, current_stage, status, university_name, program_name, study_location, qualification, study_duration_months, assigned_staff_id, applicant_name, application_email, applicant_phone, applicant_passport_no, applicant_nationality, applicant_country_of_residence, applicant_city, guardian_name, guardian_phone, guardian_email)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [appUid, studentUserId, studentUserId, staffId, 1, 'LEAD', universityName, studyProgram, studyLocation, qualification, studyDuration || null, staffId, fullName, email, phone || null, passportNo || null, nationality || null, country || null, city || null, guardianName || null, guardianPhone || null, guardianEmail || null]
    );
    const applicationId = appResult.insertId;

    const docKeys = Object.keys(files);
    await ensureDocumentUploaderColumn(connection);
    for (const key of docKeys) {
      const fileArray = files[key];
      for (const file of fileArray) {
        await connection.query(
          'INSERT INTO documents (application_id, document_type, file_path, uploaded_by_role) VALUES (?, ?, ?, ?)',
          [applicationId, key, file.path, req.user.role]
        );
      }
    }

    await connection.commit();
    res.status(201).json({
      message: 'Application created successfully',
      applicationId,
      app_uid: appUid
    });

  } catch (error) {
    await connection.rollback();
    console.error('Transaction Error in createNewApplication:', error);
    res.status(500).json({ message: 'Failed to create application.' });
  } finally {
    connection.release();
  }
};

// @desc    Upload a document for the logged-in client's application
// @route   POST /api/applications/:id/documents
// @access  Private/Client
export const uploadApplicationDocument = async (req, res) => {
  try {
    await ensureApplicationLifecycleSchema();

    const applicationId = req.params.id;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ message: 'Document file is required' });
    }

    const [applications] = await db.query(
      'SELECT id FROM applications WHERE id = ? AND student_id = ?',
      [applicationId, req.user.id]
    );

    if (applications.length === 0) {
      return res.status(404).json({ message: 'Application not found' });
    }

    const documentType = req.body.document_type || 'clientUpload';
    await ensureDocumentUploaderColumn();
    const [result] = await db.query(
      'INSERT INTO documents (application_id, document_type, file_path, uploaded_by_role) VALUES (?, ?, ?, ?)',
      [applicationId, documentType, file.path, req.user.role]
    );

    res.status(201).json({
      message: 'Document uploaded successfully',
      documentId: result.insertId
    });
  } catch (error) {
    console.error('Error in uploadApplicationDocument:', error);
    res.status(500).json({ message: 'Failed to upload document' });
  }
};

// @desc    Upload missing documents and return the application to counselor review
// @route   PUT /api/applications/:id/upload-missing-docs
// @access  Private/Client
export const uploadMissingDocuments = async (req, res) => {
  const connection = await db.getConnection();

  try {
    await ensureApplicationLifecycleSchema(connection);
    await ensureDocumentUploaderColumn(connection);
    await ensureNotificationsTable(connection);

    const applicationId = req.params.id;
    const files = req.files || [];

    if (!files.length) {
      return res.status(400).json({ message: 'At least one missing document file is required' });
    }

    const [applications] = await connection.query(
      `SELECT id, app_uid, student_id, client_id, assigned_staff_id, counselor_id, status
       FROM applications
       WHERE id = ? AND (student_id = ? OR client_id = ?)`,
      [applicationId, req.user.id, req.user.id]
    );

    if (applications.length === 0) {
      return res.status(404).json({ message: 'Application not found' });
    }

    const application = applications[0];
    if (application.status !== 'PENDING_DOCS') {
      return res.status(400).json({ message: 'This application is not currently waiting for missing documents' });
    }

    await connection.beginTransaction();

    for (const file of files) {
      await connection.query(
        'INSERT INTO documents (application_id, document_type, file_path, uploaded_by_role) VALUES (?, ?, ?, ?)',
        [applicationId, req.body.document_type || 'Missing Document', file.path, 'client']
      );
    }

    await connection.query(
      "UPDATE applications SET status = 'DOCS_VERIFICATION', missing_docs_note = NULL WHERE id = ?",
      [applicationId]
    );

    const counselorId = application.counselor_id || application.assigned_staff_id;
    if (counselorId) {
      await connection.query(
        `INSERT INTO notifications (user_id, message, type, application_id, app_uid, target_url, is_read)
         VALUES (?, ?, 'missing_documents_uploaded', ?, ?, ?, FALSE)`,
        [
          counselorId,
          `Missing documents were uploaded for ${application.app_uid}. Please review the application again.`,
          applicationId,
          application.app_uid,
          `/staff/clients?openApp=${encodeURIComponent(application.app_uid)}`
        ]
      );
    }

    await connection.commit();

    res.json({
      message: 'Missing documents uploaded and returned to document verification',
      application_id: applicationId,
      app_uid: application.app_uid,
      status: 'DOCS_VERIFICATION'
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error in uploadMissingDocuments:', error);
    res.status(500).json({ message: 'Failed to upload missing documents' });
  } finally {
    connection.release();
  }
};
