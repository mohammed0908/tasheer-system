import db from '../config/db.js';
import nodemailer from 'nodemailer';
import { ensureNotificationsTable } from './taskController.js';

const PORTAL_PAYMENT_URL = process.env.CLIENT_PAYMENT_URL || 'https://yourdomain.com/client/payments';
const PAYMENT_APPLICATION_STATUSES = [
  'LEAD',
  'PENDING_CS_REVIEW',
  'COUNSELOR_ASSIGNED',
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
const applicationStatusEnumSql = `ENUM(${PAYMENT_APPLICATION_STATUSES.map(status => `'${status}'`).join(', ')}) DEFAULT 'LEAD'`;
const departmentAliases = {
  Ops: 'Operations',
  Accountant: 'Finance',
  'Financial Manager': 'Finance',
  Counselor: 'Counselor',
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

const ensureInvoiceColumns = async (connection = db) => {
  const alterStatements = [
    "ALTER TABLE payments MODIFY payment_status ENUM('pending', 'completed', 'overdue', 'rejected', 'Pending', 'Paid', 'Overdue', 'Pending Verification', 'Rejected') DEFAULT 'Pending'",
    'ALTER TABLE payments ADD COLUMN client_id INT NULL',
    'ALTER TABLE payments ADD COLUMN description VARCHAR(255) NULL',
    'ALTER TABLE payments ADD COLUMN due_date DATE NULL',
    'ALTER TABLE payments ADD COLUMN receipt_path VARCHAR(255) NULL',
    'ALTER TABLE payments ADD COLUMN verified_at TIMESTAMP NULL DEFAULT NULL',
    'ALTER TABLE payments ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
  ];

  for (const statement of alterStatements) {
    try {
      await connection.query(statement);
    } catch (error) {
      if (error.code !== 'ER_DUP_FIELDNAME') {
        throw error;
      }
    }
  }

  try {
    await connection.query(
      `UPDATE applications
       SET status = 'VISA_COMPLETED'
       WHERE status IN ('ACCOMMODATION_READY', 'FLIGHT_BOOKED', 'ARRIVED', 'MEDICAL_CLEARED', 'COMPLETED')`
    );
    await connection.query(`ALTER TABLE applications MODIFY status ${applicationStatusEnumSql}`);
  } catch (error) {
    if (error.code !== 'ER_BAD_FIELD_ERROR') {
      throw error;
    }
  }
};

const createEmailTransporter = () => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    return null;
  }

  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: Number(process.env.EMAIL_PORT || 587),
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
};

const toDisplayStatus = (status) => {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'completed' || normalized === 'paid') return 'Paid';
  if (normalized === 'overdue') return 'Overdue';
  if (normalized === 'pending verification') return 'Pending Verification';
  if (normalized === 'rejected') return 'Rejected';
  return 'Pending';
};

const toPublicFilePath = (filePath) => {
  if (!filePath) return null;
  const normalizedPath = filePath.replace(/\\/g, '/');
  return normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`;
};

const notifyFinanceStaff = async (connection, { invoiceId, applicationId = null, appUid = null, message, type = 'invoice_update' }) => {
  if (!invoiceId || !message) return;

  await ensureNotificationsTable(connection);
  const [financeStaff] = await connection.query(
    `SELECT id
     FROM users
     WHERE role = 'staff'
       AND (
         department = 'Finance'
         OR job_title LIKE '%Accountant%'
         OR job_title LIKE '%Finance%'
         OR job_title LIKE '%Financial%'
       )`
  );

  for (const staff of financeStaff) {
    await connection.query(
      `INSERT INTO notifications (user_id, message, type, application_id, app_uid, target_url)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        staff.id,
        message,
        type,
        applicationId,
        appUid,
        `/staff/invoices?highlight=${invoiceId}`
      ]
    );
  }
};

export const getAllPayments = async (req, res) => {
  try {
    await ensureInvoiceColumns();

    const [payments] = await db.query(`
      SELECT 
        p.payment_id, 
        p.client_id,
        COALESCE(p.description, 'Application Fee') AS description,
        p.amount, 
        p.payment_status, 
        p.payment_date, 
        p.due_date,
        p.receipt_path,
        p.verified_at,
        p.created_at,
        a.app_uid,
        a.university_name,
        a.program_name,
        a.applicant_passport_no,
        a.applicant_phone,
        COALESCE(u.full_name, a.applicant_name) AS client_name,
        COALESCE(u.email, a.application_email) AS client_email,
        COALESCE(s.phone, a.applicant_phone) AS client_phone,
        COALESCE(s.passport_no, a.applicant_passport_no) AS passport_number
      FROM payments p 
      LEFT JOIN applications a ON p.application_id = a.id 
      LEFT JOIN users u ON COALESCE(p.client_id, a.student_id) = u.id
      LEFT JOIN students s ON u.id = s.user_id
      ORDER BY COALESCE(p.created_at, p.payment_date) DESC, p.payment_id DESC
    `);
    
    res.json(payments.map(payment => ({
      ...payment,
      payment_status: toDisplayStatus(payment.payment_status),
      receipt_path: toPublicFilePath(payment.receipt_path),
      receipt_url: toPublicFilePath(payment.receipt_path)
    })));
  } catch (error) {
    console.error('Error in getAllPayments:', error);
    res.status(500).json({ message: 'Server error while fetching payments' });
  }
};

export const createInvoice = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const { client_id, application_id, amount, description, due_date } = req.body;

    if ((!client_id && !application_id) || !amount || !description || !due_date) {
      return res.status(400).json({ message: 'Application, amount, description, and due date are required' });
    }

    await ensureInvoiceColumns(connection);
    await ensureNotificationsTable(connection);
    await connection.beginTransaction();

    const [actorRows] = await connection.query(
      'SELECT role, department, job_title FROM users WHERE id = ?',
      [req.user.id]
    );
    const actor = actorRows[0] || {};
    const actorDepartment = normalizeDepartment(actor);

    if (actor.role !== 'admin' && actorDepartment !== 'Counselor') {
      await connection.rollback();
      return res.status(403).json({ message: 'Only Counselors can create invoices for admission-issued applications' });
    }

    let invoiceApplicationId = application_id || null;
    let invoiceAppUid = null;
    let assignedStaffId = null;
    let invoiceClientId = client_id || null;
    let invoiceClientName = 'Client';
    let invoiceClientEmail = null;

    if (invoiceApplicationId) {
      const [applications] = await connection.query(
        `SELECT
          a.id,
          a.app_uid,
          a.status,
          a.assigned_staff_id,
          a.student_id,
          a.client_id,
          a.applicant_name,
          a.application_email,
          u.full_name AS user_name,
          u.email AS user_email
         FROM applications a
         LEFT JOIN users u ON COALESCE(a.student_id, a.client_id) = u.id
         WHERE a.id = ?`,
        [invoiceApplicationId]
      );

      if (applications.length === 0) {
        await connection.rollback();
        return res.status(404).json({ message: 'Selected application was not found' });
      }

      if (applications[0].status !== 'OFFER_APPROVED') {
        await connection.rollback();
        return res.status(400).json({ message: 'Invoices can only be created after the offer letter is approved.' });
      }

      if (client_id && applications[0].student_id && Number(applications[0].student_id) !== Number(client_id)) {
        await connection.rollback();
        return res.status(400).json({ message: 'Selected application does not belong to this client' });
      }

      invoiceClientId = applications[0].student_id || applications[0].client_id || client_id || null;
      invoiceClientName = applications[0].user_name || applications[0].applicant_name || 'Client';
      invoiceClientEmail = applications[0].user_email || applications[0].application_email || null;
      assignedStaffId = applications[0].assigned_staff_id;
      invoiceAppUid = applications[0].app_uid || null;
    } else {
      const [clients] = await connection.query(
        "SELECT id, full_name, email FROM users WHERE id = ? AND role = 'client'",
        [client_id]
      );

      if (clients.length === 0) {
        await connection.rollback();
        return res.status(404).json({ message: 'Client not found' });
      }

      invoiceClientId = clients[0].id;
      invoiceClientName = clients[0].full_name || 'Client';
      invoiceClientEmail = clients[0].email || null;

      const [applications] = await connection.query(
        "SELECT id, app_uid, status, assigned_staff_id FROM applications WHERE student_id = ? AND status = 'OFFER_APPROVED' ORDER BY updated_at DESC LIMIT 1",
        [client_id]
      );

      if (applications.length > 0) {
        invoiceApplicationId = applications[0].id;
        assignedStaffId = applications[0].assigned_staff_id;
        invoiceAppUid = applications[0].app_uid || null;
      } else {
        await connection.rollback();
        return res.status(400).json({ message: 'No admission-issued application is ready for invoice creation.' });
      }
    }

    const [invoiceResult] = await connection.query(
      `INSERT INTO payments (client_id, application_id, amount, description, due_date, payment_status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [invoiceClientId, invoiceApplicationId, amount, description, due_date, 'Pending']
    );
    const invoiceId = invoiceResult.insertId;

    if (invoiceClientId) {
      await connection.query(
        `INSERT INTO notifications (user_id, message, type, application_id, app_uid, target_url)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [invoiceClientId, `You have a new pending invoice for ${description}.`, 'invoice', invoiceApplicationId, invoiceAppUid, '/client/payments']
      );
    }

    if (invoiceApplicationId) {
      await connection.query(
        "UPDATE applications SET status = 'PENDING_PAYMENT' WHERE id = ?",
        [invoiceApplicationId]
      );
    }

    if (assignedStaffId) {
      await connection.query(
        `INSERT INTO notifications (user_id, message, type, application_id, app_uid, target_url)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [assignedStaffId, `A new invoice was generated for your client ${invoiceClientName}.`, 'invoice', invoiceApplicationId, invoiceAppUid, '/staff/invoices']
      );
    }

    const [admins] = await connection.query("SELECT id FROM users WHERE role = 'admin'");
    for (const admin of admins) {
      await connection.query(
        `INSERT INTO notifications (user_id, message, type, application_id, app_uid, target_url)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [admin.id, `New invoice requires review: ${description}.`, 'invoice', invoiceApplicationId, invoiceAppUid, '/admin/finance']
      );
    }

    await notifyFinanceStaff(connection, {
      invoiceId,
      applicationId: invoiceApplicationId,
      appUid: invoiceAppUid,
      type: 'invoice_created',
      message: `New invoice created for ${invoiceClientName}: ${description}.`
    });

    await connection.commit();

    const transporter = createEmailTransporter();
    if (transporter && invoiceClientEmail) {
      try {
        await transporter.sendMail({
          from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
          to: invoiceClientEmail,
          subject: `New invoice: ${description}`,
          html: `
            <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.5;">
              <h2 style="color: #0f3b63;">New Invoice</h2>
              <p>Hello ${invoiceClientName},</p>
              <p>You have a new pending invoice in your Tasheer portal.</p>
              <table style="border-collapse: collapse; margin: 16px 0;">
                <tr><td style="padding: 6px 12px; font-weight: bold;">Description</td><td style="padding: 6px 12px;">${description}</td></tr>
                <tr><td style="padding: 6px 12px; font-weight: bold;">Amount</td><td style="padding: 6px 12px;">USD ${Number(amount).toFixed(2)}</td></tr>
                <tr><td style="padding: 6px 12px; font-weight: bold;">Due Date</td><td style="padding: 6px 12px;">${due_date}</td></tr>
              </table>
              <p>
                <a href="${PORTAL_PAYMENT_URL}" style="background: #0f3b63; color: white; padding: 10px 14px; text-decoration: none; border-radius: 6px;">
                  View and Pay Invoice
                </a>
              </p>
            </div>
          `
        });
      } catch (emailError) {
        console.error('Invoice created, but email failed:', emailError);
      }
    }

    res.status(201).json({
      message: 'Invoice created successfully',
      invoiceId
    });
  } catch (error) {
    try {
      await connection.rollback();
    } catch (rollbackError) {
      console.error('Rollback failed:', rollbackError);
    }
    console.error('Error in createInvoice:', error);
    res.status(500).json({ message: 'Server error while creating invoice' });
  } finally {
    connection.release();
  }
};

export const getMyInvoices = async (req, res) => {
  try {
    await ensureInvoiceColumns();

    const [invoices] = await db.query(
      `SELECT
        p.payment_id,
        p.client_id,
        p.application_id,
        COALESCE(p.description, 'Application Fee') AS description,
        p.amount,
        p.payment_status,
        p.payment_date,
        p.due_date,
        p.receipt_path,
        p.verified_at,
        p.created_at,
        a.app_uid,
        a.university_name,
        a.program_name,
        a.applicant_passport_no,
        a.applicant_phone,
        COALESCE(u.full_name, a.applicant_name) AS client_name,
        COALESCE(u.email, a.application_email) AS client_email,
        COALESCE(s.phone, a.applicant_phone) AS client_phone,
        COALESCE(s.passport_no, a.applicant_passport_no) AS passport_number
       FROM payments p
       LEFT JOIN applications a ON p.application_id = a.id
       LEFT JOIN users u ON COALESCE(p.client_id, a.student_id) = u.id
       LEFT JOIN students s ON u.id = s.user_id
       WHERE COALESCE(p.client_id, a.student_id) = ?
       ORDER BY COALESCE(p.created_at, p.payment_date) DESC, p.payment_id DESC`,
      [req.user.id]
    );

    res.json(invoices.map(invoice => ({
      ...invoice,
      payment_status: toDisplayStatus(invoice.payment_status),
      receipt_path: toPublicFilePath(invoice.receipt_path),
      receipt_url: toPublicFilePath(invoice.receipt_path)
    })));
  } catch (error) {
    console.error('Error in getMyInvoices:', error);
    res.status(500).json({ message: 'Server error while fetching invoices' });
  }
};

export const getInvoiceById = async (req, res) => {
  try {
    await ensureInvoiceColumns();

    const [invoices] = await db.query(
      `SELECT
        p.payment_id,
        p.client_id,
        p.application_id,
        COALESCE(p.description, 'Application Fee') AS description,
        p.amount,
        p.payment_status,
        p.payment_date,
        p.due_date,
        p.receipt_path,
        p.verified_at,
        p.created_at,
        a.app_uid,
        a.university_name,
        a.program_name,
        COALESCE(u.full_name, a.applicant_name) AS client_name,
        COALESCE(u.email, a.application_email) AS client_email,
        COALESCE(s.phone, a.applicant_phone) AS client_phone,
        COALESCE(s.passport_no, a.applicant_passport_no) AS passport_number
       FROM payments p
       LEFT JOIN applications a ON p.application_id = a.id
       LEFT JOIN users u ON COALESCE(p.client_id, a.student_id) = u.id
       LEFT JOIN students s ON u.id = s.user_id
       WHERE p.payment_id = ?`,
      [req.params.id]
    );

    if (invoices.length === 0) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    const invoice = invoices[0];
    const receiptUrl = toPublicFilePath(invoice.receipt_path);

    res.json({
      ...invoice,
      id: invoice.payment_id,
      payment_status: toDisplayStatus(invoice.payment_status),
      receipt_path: receiptUrl,
      receipt_url: receiptUrl
    });
  } catch (error) {
    console.error('Error in getInvoiceById:', error);
    res.status(500).json({ message: 'Server error while fetching invoice' });
  }
};

export const uploadPaymentReceipt = async (req, res) => {
  try {
    const invoiceId = req.params.id;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ message: 'Payment receipt image is required' });
    }

    await ensureInvoiceColumns();
    await ensureNotificationsTable();

    const [invoices] = await db.query(
      `SELECT
        p.payment_id,
        p.application_id,
        COALESCE(p.description, 'Application Fee') AS description,
        a.app_uid,
        u.full_name AS client_name
       FROM payments p
       LEFT JOIN applications a ON p.application_id = a.id
       LEFT JOIN users u ON COALESCE(p.client_id, a.student_id) = u.id
       WHERE p.payment_id = ? AND COALESCE(p.client_id, a.student_id) = ?`,
      [invoiceId, req.user.id]
    );

    if (invoices.length === 0) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    await db.query(
      "UPDATE payments SET receipt_path = ?, payment_status = 'Pending Verification', payment_date = CURDATE() WHERE payment_id = ?",
      [file.path, invoiceId]
    );

    if (invoices[0].application_id) {
      await db.query(
        "UPDATE applications SET status = 'WAITING_PAYMENT_VERIFICATION' WHERE id = ?",
        [invoices[0].application_id]
      );
    }

    await notifyFinanceStaff(db, {
      invoiceId,
      applicationId: invoices[0].application_id,
      appUid: invoices[0].app_uid,
      type: 'invoice_verification_required',
      message: `Payment receipt uploaded for invoice #${invoiceId} by ${invoices[0].client_name || 'a client'}. Verification required.`
    });

    res.json({ message: 'Receipt uploaded successfully. Your payment is waiting for payment verification.' });
  } catch (error) {
    console.error('Error in uploadPaymentReceipt:', error);
    res.status(500).json({ message: 'Server error while uploading receipt' });
  }
};

export const verifyPayment = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const invoiceId = req.params.id;
    const { status } = req.body;

    if (!['Paid', 'Rejected'].includes(status)) {
      return res.status(400).json({ message: "Status must be either 'Paid' or 'Rejected'" });
    }

    await ensureInvoiceColumns(connection);
    await ensureNotificationsTable(connection);
    await connection.beginTransaction();

    const [actorRows] = await connection.query(
      'SELECT role, department, job_title FROM users WHERE id = ?',
      [req.user.id]
    );
    const actor = actorRows[0] || {};
    const actorDepartment = normalizeDepartment(actor);

    if (actorDepartment !== 'Finance') {
      await connection.rollback();
      return res.status(403).json({ message: 'Only Finance staff can verify payments' });
    }

    const [invoices] = await connection.query(
      `SELECT
        p.payment_id,
        COALESCE(p.client_id, a.student_id) AS client_id,
        COALESCE(p.description, 'Application Fee') AS description,
        p.amount,
        p.application_id,
        a.app_uid,
        u.full_name AS client_name,
        u.email AS client_email
       FROM payments p
       LEFT JOIN applications a ON p.application_id = a.id
       LEFT JOIN users u ON COALESCE(p.client_id, a.student_id) = u.id
       WHERE p.payment_id = ?`,
      [invoiceId]
    );

    if (invoices.length === 0 || !invoices[0].client_id) {
      await connection.rollback();
      return res.status(404).json({ message: 'Invoice not found' });
    }

    const invoice = invoices[0];
    await connection.query(
      `UPDATE payments
       SET payment_status = ?,
           payment_date = CASE WHEN ? = 'Paid' THEN CURDATE() ELSE payment_date END,
           verified_at = CASE WHEN ? = 'Paid' THEN CURRENT_TIMESTAMP ELSE verified_at END
       WHERE payment_id = ?`,
      [status, status, status, invoiceId]
    );

    if (invoice.application_id) {
      await connection.query(
        'UPDATE applications SET status = ? WHERE id = ?',
        [status === 'Paid' ? 'PAYMENT_VERIFIED' : 'PENDING_PAYMENT', invoice.application_id]
      );
    }

    const notificationMessage = status === 'Paid'
      ? `Your payment for ${invoice.description} has been verified and approved. Thank you!`
      : `Your first transaction for ${invoice.description} was rejected. Please try again from the Payments page.`;

    await connection.query(
      'INSERT INTO notifications (user_id, message, type, application_id, app_uid, target_url) VALUES (?, ?, ?, ?, ?, ?)',
      [
        invoice.client_id,
        notificationMessage,
        status === 'Paid' ? 'payment_verification' : 'payment_rejected',
        invoice.application_id,
        invoice.app_uid,
        '/client/payments'
      ]
    );

    await notifyFinanceStaff(connection, {
      invoiceId,
      applicationId: invoice.application_id,
      appUid: invoice.app_uid,
      type: status === 'Paid' ? 'invoice_verified_paid' : 'invoice_rejected',
      message: status === 'Paid'
        ? `Invoice #${invoiceId} has been verified and marked Paid.`
        : `Invoice #${invoiceId} payment was rejected.`
    });

    if (status === 'Paid' && invoice.application_id) {
      const [operationsStaff] = await connection.query(
        "SELECT id FROM users WHERE role = 'staff' AND (department = 'Operations' OR job_title LIKE '%Operations%')"
      );

      for (const staff of operationsStaff) {
        await connection.query(
          `INSERT INTO notifications (user_id, message, type, application_id, app_uid, target_url)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            staff.id,
            `Payment is paid for ${invoice.app_uid || `invoice #${invoiceId}`}. Please apply for visa.`,
            'payment_paid_visa_ready',
            invoice.application_id,
            invoice.app_uid,
            invoice.app_uid ? `/staff/clients?openApp=${invoice.app_uid}` : '/staff/clients'
          ]
        );
      }
    }

    await connection.commit();

    const transporter = createEmailTransporter();
    if (transporter && invoice.client_email) {
      try {
        const approved = status === 'Paid';
        await transporter.sendMail({
          from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
          to: invoice.client_email,
          subject: approved ? `Payment approved: ${invoice.description}` : `Payment receipt needs review: ${invoice.description}`,
          html: `
            <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.5;">
              <h2 style="color: ${approved ? '#15803d' : '#b91c1c'};">${approved ? 'Payment Approved' : 'Receipt Review Needed'}</h2>
              <p>Hello ${invoice.client_name || 'there'},</p>
              <p>${notificationMessage}</p>
              <p><strong>Description:</strong> ${invoice.description}</p>
              <p><strong>Amount:</strong> USD ${Number(invoice.amount).toFixed(2)}</p>
              <p>
                <a href="${PORTAL_PAYMENT_URL}" style="background: #0f3b63; color: white; padding: 10px 14px; text-decoration: none; border-radius: 6px;">
                  View Payment Portal
                </a>
              </p>
            </div>
          `
        });
      } catch (emailError) {
        console.error('Payment verified, but email failed:', emailError);
      }
    }

    res.json({ message: `Payment marked as ${status}` });
  } catch (error) {
    try {
      await connection.rollback();
    } catch (rollbackError) {
      console.error('Rollback failed:', rollbackError);
    }
    console.error('Error in verifyPayment:', error);
    res.status(500).json({ message: 'Server error while verifying payment' });
  } finally {
    connection.release();
  }
};

export const simulatePayment = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const { invoice_id, amount, card_last_four } = req.body;

    if (!invoice_id || !amount || !card_last_four) {
      return res.status(400).json({ message: 'Invoice, amount, and card details are required' });
    }

    await ensureInvoiceColumns(connection);
    await ensureNotificationsTable(connection);
    await connection.beginTransaction();

    const [invoices] = await connection.query(
      `SELECT
        p.payment_id,
        p.application_id,
        COALESCE(p.client_id, a.student_id) AS client_id,
        COALESCE(p.description, 'Application Fee') AS description,
        p.amount,
        p.payment_status,
        a.app_uid,
        a.counselor_id,
        a.assigned_staff_id,
        u.full_name AS client_name
       FROM payments p
       LEFT JOIN applications a ON p.application_id = a.id
       LEFT JOIN users u ON COALESCE(p.client_id, a.student_id) = u.id
       WHERE p.payment_id = ?`,
      [invoice_id]
    );

    if (invoices.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Invoice not found' });
    }

    const invoice = invoices[0];
    if (Number(invoice.client_id) !== Number(req.user.id)) {
      await connection.rollback();
      return res.status(403).json({ message: 'You can only pay your own invoices' });
    }

    if (!['Pending', 'Rejected', 'Overdue'].includes(toDisplayStatus(invoice.payment_status))) {
      await connection.rollback();
      return res.status(400).json({ message: 'Only pending or rejected invoices can be paid online' });
    }

    const requestedAmount = Number(amount);
    const invoiceAmount = Number(invoice.amount || 0);
    if (!Number.isFinite(requestedAmount) || Math.abs(requestedAmount - invoiceAmount) > 0.01) {
      await connection.rollback();
      return res.status(400).json({ message: 'Payment amount does not match this invoice' });
    }

    const transactionId = `TXN-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    await connection.query(
      `UPDATE payments
       SET payment_status = 'Paid',
           payment_date = CURDATE(),
           verified_at = CURRENT_TIMESTAMP
       WHERE payment_id = ?`,
      [invoice.payment_id]
    );

    if (invoice.application_id) {
      await connection.query(
        "UPDATE applications SET status = 'PAYMENT_VERIFIED' WHERE id = ?",
        [invoice.application_id]
      );

      const counselorId = invoice.counselor_id || invoice.assigned_staff_id;
      if (counselorId) {
        await connection.query(
          `INSERT INTO notifications (user_id, message, type, application_id, app_uid, target_url)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            counselorId,
            `Invoice Paid for ${invoice.app_uid || `invoice #${invoice.payment_id}`}`,
            'invoice_paid',
            invoice.application_id,
            invoice.app_uid,
            invoice.app_uid ? `/staff/clients?openApp=${invoice.app_uid}` : '/staff/clients'
          ]
        );
      }

      const [operationsStaff] = await connection.query(
        "SELECT id FROM users WHERE role = 'staff' AND (department = 'Operations' OR job_title LIKE '%Operations%')"
      );

      for (const staff of operationsStaff) {
        await connection.query(
          `INSERT INTO notifications (user_id, message, type, application_id, app_uid, target_url)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            staff.id,
            `Payment verified for ${invoice.client_name || 'a client'}. Please begin visa processing.`,
            'payment_verified',
            invoice.application_id,
            invoice.app_uid,
            invoice.app_uid ? `/staff/clients?openApp=${invoice.app_uid}` : '/staff/clients'
          ]
        );
      }
    }

    await connection.query(
      'INSERT INTO notifications (user_id, message, type, application_id, app_uid, target_url) VALUES (?, ?, ?, ?, ?, ?)',
      [
        invoice.client_id,
        `Online payment received for ${invoice.description}. Transaction ${transactionId}.`,
        'payment_success',
        invoice.application_id,
        invoice.app_uid,
        '/client/payments'
      ]
    );

    await notifyFinanceStaff(connection, {
      invoiceId: invoice.payment_id,
      applicationId: invoice.application_id,
      appUid: invoice.app_uid,
      type: 'invoice_paid_online',
      message: `Invoice #${invoice.payment_id} was paid online. Transaction ${transactionId}.`
    });

    await connection.commit();

    res.json({
      message: 'Payment processed successfully',
      transaction_id: transactionId,
      invoice_id: invoice.payment_id,
      amount: invoiceAmount,
      card_last_four: String(card_last_four).slice(-4),
      status: 'PAID',
      application_status: invoice.application_id ? 'PAYMENT_VERIFIED' : null,
      paid_at: new Date().toISOString()
    });
  } catch (error) {
    try {
      await connection.rollback();
    } catch (rollbackError) {
      console.error('Rollback failed:', rollbackError);
    }
    console.error('Error in simulatePayment:', error);
    res.status(500).json({ message: 'Server error while processing simulated payment' });
  } finally {
    connection.release();
  }
};
