import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../config/db.js';
import sendEmail from '../utils/sendEmail.js';

const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;

const generateCode = () => String(Math.floor(100000 + Math.random() * 900000));

const ensureAuthColumns = async () => {
  let addedIsVerified = false;
  const columns = [
    ['is_verified', 'BOOLEAN DEFAULT FALSE'],
    ['otp', 'VARCHAR(10) DEFAULT NULL'],
    ['otp_expiry', 'DATETIME DEFAULT NULL'],
    ['verification_code', 'VARCHAR(20) DEFAULT NULL'],
    ['reset_token', 'VARCHAR(20) DEFAULT NULL'],
    ['reset_token_expiry', 'DATETIME DEFAULT NULL']
  ];

  for (const [column, definition] of columns) {
    try {
      await db.query(`ALTER TABLE users ADD COLUMN ${column} ${definition}`);
      if (column === 'is_verified') {
        addedIsVerified = true;
      }
    } catch (error) {
      if (error.code !== 'ER_DUP_FIELDNAME') {
        throw error;
      }
    }
  }

  if (addedIsVerified) {
    await db.query("UPDATE users SET is_verified = TRUE WHERE role IN ('admin', 'staff')");
  }

  await db.query("UPDATE users SET is_verified = TRUE WHERE role IN ('admin', 'staff') AND (is_verified = FALSE OR is_verified IS NULL)");
};

const ensureClientApplicationLinkColumns = async () => {
  const statements = [
    'ALTER TABLE applications MODIFY student_id INT NULL',
    'ALTER TABLE applications ADD COLUMN client_id INT DEFAULT NULL',
    'ALTER TABLE applications ADD COLUMN applicant_name VARCHAR(255) DEFAULT NULL',
    'ALTER TABLE applications ADD COLUMN application_email VARCHAR(255) DEFAULT NULL',
    'ALTER TABLE applications ADD COLUMN applicant_phone VARCHAR(50) DEFAULT NULL',
    'ALTER TABLE applications ADD COLUMN applicant_passport_no VARCHAR(100) DEFAULT NULL',
    'ALTER TABLE applications ADD COLUMN applicant_nationality VARCHAR(100) DEFAULT NULL',
    'ALTER TABLE applications ADD COLUMN applicant_country_of_residence VARCHAR(100) DEFAULT NULL',
    'ALTER TABLE applications ADD COLUMN applicant_city VARCHAR(100) DEFAULT NULL',
    'ALTER TABLE applications ADD COLUMN guardian_name VARCHAR(255) DEFAULT NULL',
    'ALTER TABLE applications ADD COLUMN guardian_phone VARCHAR(50) DEFAULT NULL',
    'ALTER TABLE applications ADD COLUMN guardian_email VARCHAR(255) DEFAULT NULL'
  ];

  for (const statement of statements) {
    try {
      await db.query(statement);
    } catch (error) {
      if (error.code !== 'ER_DUP_FIELDNAME') {
        throw error;
      }
    }
  }
};

const validatePassword = (password) => passwordRegex.test(password || '');

const toAuthUser = (user) => ({
  id: user.id,
  full_name: user.full_name,
  email: user.email,
  role: user.role,
  department: user.department || '',
  job_title: user.job_title || '',
  profile_image_url: user.profile_image_url || null
});

const sendVerificationEmail = async (email, code) => {
  await sendEmail(
    email,
    'Verify your TSMS account',
    `Your TSMS verification code is ${code}. It expires in 10 minutes.`,
    `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
        <h2>Verify your TSMS account</h2>
        <p>Use this 6-digit code to verify your email address. It expires in 10 minutes.</p>
        <p style="font-size:28px;font-weight:800;letter-spacing:6px;color:#2563eb">${code}</p>
        <p>If you did not create a TSMS account, you can ignore this email.</p>
      </div>
    `
  );
};

const sendResetEmail = async (email, code) => {
  await sendEmail(
    email,
    'Reset your TSMS password',
    `Your TSMS password reset code is ${code}. It expires in 10 minutes.`,
    `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
        <h2>Reset your TSMS password</h2>
        <p>Use this 6-digit code to reset your password. It expires in 10 minutes.</p>
        <p style="font-size:28px;font-weight:800;letter-spacing:6px;color:#2563eb">${code}</p>
        <p>If you did not request this reset, you can ignore this email.</p>
      </div>
    `
  );
};

export const registerUser = async (req, res) => {
  try {
    await ensureAuthColumns();

    const { name, full_name, email, password } = req.body;
    const fullName = name || full_name;

    if (!fullName || !email || !password) {
      return res.status(400).json({ message: 'Please provide name, email, and password' });
    }

    if (!validatePassword(password)) {
      return res.status(400).json({
        message: 'Password must be at least 8 characters and include uppercase, lowercase, number, and special character'
      });
    }

    const [existingUsers] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existingUsers.length > 0) {
      return res.status(400).json({ message: 'User exists, please try signing in instead' });
    }

    await ensureClientApplicationLinkColumns();

    const hashedPassword = await bcrypt.hash(password, 10);
    const otp = generateCode();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    const [result] = await db.query(
      `INSERT INTO users (full_name, email, password, role, is_verified, otp, otp_expiry, verification_code)
       VALUES (?, ?, ?, 'client', FALSE, ?, ?, ?)`,
      [fullName, email, hashedPassword, otp, otpExpiry, otp]
    );

    const userId = result.insertId;
    const [matchingApplications] = await db.query(
      `SELECT applicant_passport_no, applicant_nationality, applicant_phone, applicant_country_of_residence, applicant_city,
              guardian_name, guardian_phone, guardian_email
       FROM applications
       WHERE application_email = ? AND student_id IS NULL
       ORDER BY created_at DESC
       LIMIT 1`,
      [email]
    );
    const applicationDetails = matchingApplications[0] || {};

    await db.query(
      `INSERT INTO students
        (user_id, passport_no, nationality, phone, country_of_residence, city, guardian_name, guardian_phone, guardian_email)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        applicationDetails.applicant_passport_no || null,
        applicationDetails.applicant_nationality || null,
        applicationDetails.applicant_phone || null,
        applicationDetails.applicant_country_of_residence || null,
        applicationDetails.applicant_city || null,
        applicationDetails.guardian_name || null,
        applicationDetails.guardian_phone || null,
        applicationDetails.guardian_email || null
      ]
    );

    await db.query(
      `UPDATE applications
       SET student_id = ?, client_id = ?
       WHERE application_email = ? AND student_id IS NULL`,
      [userId, userId, email]
    );

    await sendVerificationEmail(email, otp);

    res.status(201).json({
      message: 'Account created. Please verify your email with the OTP we sent.',
      requiresOtp: true,
      requiresVerification: true,
      userId,
      email
    });
  } catch (error) {
    console.error('Error in registerUser:', error);
    res.status(500).json({ message: 'Server error while registering user' });
  }
};

export const verifyEmail = async (req, res) => {
  try {
    await ensureAuthColumns();

    const { email, code, otp } = req.body;
    const submittedOtp = otp || code;

    if (!email || !submittedOtp) {
      return res.status(400).json({ message: 'Email and verification code are required' });
    }

    const [users] = await db.query(
      'SELECT id, otp, otp_expiry, verification_code, is_verified FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      return res.status(400).json({ message: 'Invalid verification code' });
    }

    const user = users[0];
    const storedOtp = user.otp || user.verification_code;

    if (
      String(storedOtp) !== String(submittedOtp) ||
      !user.otp_expiry ||
      new Date(user.otp_expiry).getTime() < Date.now()
    ) {
      return res.status(400).json({ message: 'Invalid or expired verification code' });
    }

    await db.query(
      'UPDATE users SET is_verified = TRUE, otp = NULL, otp_expiry = NULL, verification_code = NULL WHERE email = ?',
      [email]
    );

    res.json({ message: 'Email verified successfully. You can now log in.' });
  } catch (error) {
    console.error('Error in verifyEmail:', error);
    res.status(500).json({ message: 'Server error while verifying email' });
  }
};

export const verifyRegistration = verifyEmail;

export const loginUser = async (req, res) => {
  try {
    await ensureAuthColumns();

    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide email and password' });
    }

    const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const user = users[0];
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (!user.is_verified) {
      const otp = generateCode();
      const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

      await db.query(
        'UPDATE users SET otp = ?, otp_expiry = ?, verification_code = ? WHERE id = ?',
        [otp, otpExpiry, otp, user.id]
      );
      await sendVerificationEmail(user.email, otp);

      return res.status(403).json({
        message: 'Please verify your email before signing in. A new OTP has been sent.',
        requiresVerification: true,
        requiresOtp: true,
        email: user.email
      });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role, department: user.department, job_title: user.job_title },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      token,
      user: toAuthUser(user),
    });
  } catch (error) {
    console.error('Error in loginUser:', error);
    res.status(500).json({ message: 'Server error while logging in' });
  }
};

export const getMe = async (req, res) => {
  try {
    const [users] = await db.query(
      'SELECT id, full_name, email, role, department, job_title, profile_image_url FROM users WHERE id = ?',
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(toAuthUser(users[0]));
  } catch (error) {
    console.error('Error in getMe:', error);
    res.status(500).json({ message: 'Server error while fetching authenticated user' });
  }
};

export const forgotPassword = async (req, res) => {
  try {
    await ensureAuthColumns();

    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const [users] = await db.query('SELECT id FROM users WHERE email = ?', [email]);

    if (users.length > 0) {
      const otp = generateCode();
      const expiry = new Date(Date.now() + 10 * 60 * 1000);

      await db.query(
        'UPDATE users SET otp = ?, otp_expiry = ?, reset_token = ?, reset_token_expiry = ? WHERE email = ?',
        [otp, expiry, otp, expiry, email]
      );

      await sendResetEmail(email, otp);
    }

    res.json({ message: 'If that email exists, a reset code has been sent.' });
  } catch (error) {
    console.error('Error in forgotPassword:', error);
    res.status(500).json({ message: 'Server error while requesting password reset' });
  }
};

export const resetPassword = async (req, res) => {
  try {
    await ensureAuthColumns();

    const { email, otp, reset_token, resetToken, new_password, newPassword } = req.body;
    const token = otp || reset_token || resetToken;
    const password = new_password || newPassword;

    if (!email || !token || !password) {
      return res.status(400).json({ message: 'Email, reset code, and new password are required' });
    }

    if (!validatePassword(password)) {
      return res.status(400).json({
        message: 'Password must be at least 8 characters and include uppercase, lowercase, number, and special character'
      });
    }

    const [users] = await db.query(
      'SELECT id, otp, otp_expiry, reset_token, reset_token_expiry FROM users WHERE email = ?',
      [email]
    );

    const user = users[0];
    const storedOtp = user?.otp || user?.reset_token;
    const expiry = user?.otp_expiry || user?.reset_token_expiry;

    if (
      users.length === 0 ||
      String(storedOtp) !== String(token) ||
      !expiry ||
      new Date(expiry).getTime() < Date.now()
    ) {
      return res.status(400).json({ message: 'Invalid or expired reset code' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await db.query(
      'UPDATE users SET password = ?, otp = NULL, otp_expiry = NULL, reset_token = NULL, reset_token_expiry = NULL WHERE email = ?',
      [hashedPassword, email]
    );

    res.json({ message: 'Password reset successfully. You can now log in.' });
  } catch (error) {
    console.error('Error in resetPassword:', error);
    res.status(500).json({ message: 'Server error while resetting password' });
  }
};
