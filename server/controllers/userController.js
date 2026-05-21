import db from '../config/db.js';
import bcrypt from 'bcryptjs';
import { ensureMessagesTable } from './messageController.js';
import { ensureTaskColumns } from './taskController.js';
import { ensureGoalsTable } from './goalController.js';

const ensureStaffDetailsTable = async (connection = db) => {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS staff_details (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL UNIQUE,
      gender ENUM('Male', 'Female'),
      phone VARCHAR(50),
      address VARCHAR(255),
      monthly_salary DECIMAL(10, 2),
      hire_date DATE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
};

const ensureUserProfileImageColumn = async (connection = db) => {
  try {
    await connection.query('ALTER TABLE users ADD COLUMN profile_image_url VARCHAR(255) DEFAULT NULL');
  } catch (error) {
    if (error.code !== 'ER_DUP_FIELDNAME') {
      throw error;
    }
  }
};

const ensureUserStarredColumn = async (connection = db) => {
  try {
    await connection.query('ALTER TABLE users ADD COLUMN is_starred BOOLEAN DEFAULT FALSE');
  } catch (error) {
    if (error.code !== 'ER_DUP_FIELDNAME') {
      throw error;
    }
  }
};

const ensureUserMonthlySalaryColumn = async (connection = db) => {
  try {
    await connection.query('ALTER TABLE users ADD COLUMN monthly_salary DECIMAL(10, 2) DEFAULT 0');
  } catch (error) {
    if (error.code !== 'ER_DUP_FIELDNAME') {
      throw error;
    }
  }
};

const toPublicFilePath = (filePath) => {
  if (!filePath) return null;
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

const applicationActionConfig = {
  'Customer Service': {
    statuses: ['LEAD'],
    ownerColumn: 'a.created_by_cs_id',
    title: (app) => `Verify lead intake for ${app.app_uid}`,
    subtitle: (app) => `Student: ${app.student_name || 'Unknown Student'}`
  },
  Counselor: {
    statuses: ['LEAD', 'DOCS_VERIFICATION', 'OFFER_UPLOADED', 'OFFER_APPROVED', 'VISA_PROCESSING'],
    ownerColumn: 'a.counselor_id',
    title: (app) => {
      if (app.status === 'LEAD' || app.status === 'DOCS_VERIFICATION') return `Review Docs for ${app.app_uid}`;
      if (app.status === 'OFFER_UPLOADED') return `Verify Offer Letter for ${app.app_uid}`;
      if (app.status === 'OFFER_APPROVED') return `Request Invoice for ${app.app_uid}`;
      return `Update Visa Progress for ${app.app_uid}`;
    },
    subtitle: (app) => `Student: ${app.student_name || 'Unknown Student'}`
  },
  Operations: {
    statuses: ['PENDING_OFFER_APPLY', 'PAYMENT_VERIFIED'],
    ownerColumn: null,
    title: (app) => app.status === 'PENDING_OFFER_APPLY' ? `Upload Offer Letter for ${app.app_uid}` : `Apply for Visa for ${app.app_uid}`,
    subtitle: (app) => `Student: ${app.student_name || 'Unknown Student'}`
  },
  Finance: {
    statuses: ['WAITING_PAYMENT_VERIFICATION'],
    ownerColumn: null,
    title: (app) => `Verify Payment for ${app.app_uid}`,
    subtitle: (app) => `Student: ${app.student_name || 'Unknown Student'}`
  }
};

// @desc    Get all users
// @route   GET /api/users
// @access  Private/Admin
export const getAllUsers = async (req, res) => {
  try {
    await ensureUserProfileImageColumn();
    const [users] = await db.query(
      'SELECT id, full_name, email, role, profile_image_url, created_at FROM users ORDER BY created_at DESC'
    );
    res.json(users);
  } catch (error) {
    console.error('Error in getAllUsers:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get all staff members with HR fields
// @route   GET /api/users/staff
// @access  Private/Admin
export const getStaffMembers = async (req, res) => {
  try {
    await ensureStaffDetailsTable();
    await ensureUserProfileImageColumn();
    await ensureUserStarredColumn();
    await ensureUserMonthlySalaryColumn();
    const { department } = req.query;
    const params = [];
    let departmentFilter = '';

    if (department) {
      departmentFilter = 'AND u.department = ?';
      params.push(department);
    }

    const [staff] = await db.query(
      `SELECT 
        u.id,
        u.full_name,
        u.email,
        u.role,
        u.department,
        u.job_title,
        u.staff_status as status,
        u.performance,
        u.is_starred,
        u.profile_image_url,
        sd.gender,
        sd.phone,
        sd.address,
        COALESCE(u.monthly_salary, sd.monthly_salary, 0) AS monthly_salary,
        DATE_FORMAT(COALESCE(sd.hire_date, u.created_at), '%Y-%m-%d') as hireDate,
        COUNT(t.task_id) AS total_tasks,
        SUM(CASE WHEN LOWER(t.task_status) = 'completed' THEN 1 ELSE 0 END) AS completed_tasks,
        ROUND(
          COALESCE(
            (SUM(CASE WHEN LOWER(t.task_status) = 'completed' THEN 1 ELSE 0 END) / NULLIF(COUNT(t.task_id), 0)) * 100,
            0
          ),
          0
        ) AS performance_score
       FROM users u
       LEFT JOIN staff_details sd ON u.id = sd.user_id
       LEFT JOIN tasks t ON t.assigned_to = u.id
       WHERE u.role = 'staff'
       ${departmentFilter}
       GROUP BY
        u.id,
        u.full_name,
        u.email,
        u.role,
        u.department,
        u.job_title,
        u.staff_status,
        u.performance,
        u.is_starred,
        u.profile_image_url,
        sd.gender,
        sd.phone,
        sd.address,
        u.monthly_salary,
        sd.monthly_salary,
        sd.hire_date,
        u.created_at
       ORDER BY u.created_at DESC`,
      params
    );
    res.json(staff.map(member => ({
      ...member,
      is_starred: Boolean(member.is_starred),
      total_tasks: Number(member.total_tasks || 0),
      completed_tasks: Number(member.completed_tasks || 0),
      performance_score: Number(member.performance_score || 0)
    })));
  } catch (error) {
    console.error('Error in getStaffMembers:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getMyStaffMetrics = async (req, res) => {
  try {
    await ensureTaskColumns();
    await ensureGoalsTable();

    const [taskRows] = await db.query(
      `SELECT
        COUNT(task_id) AS total_tasks,
        SUM(CASE WHEN LOWER(task_status) = 'completed' THEN 1 ELSE 0 END) AS completed_tasks,
        SUM(CASE WHEN LOWER(task_status) <> 'completed' THEN 1 ELSE 0 END) AS pending_tasks,
        ROUND(COALESCE((SUM(CASE WHEN LOWER(task_status) = 'completed' THEN 1 ELSE 0 END) / NULLIF(COUNT(task_id), 0)) * 100, 0), 0) AS performance_score
       FROM tasks
       WHERE assigned_to = ?`,
      [req.user.id]
    );

    const applicationOwnershipParams = [req.user.id, req.user.id, req.user.id, req.user.id];
    const [orderRows] = await db.query(
      `SELECT COUNT(*) AS total_orders
       FROM applications
       WHERE created_by_cs_id = ?
          OR counselor_id = ?
          OR assigned_staff_id = ?
          OR ops_id = ?`,
      applicationOwnershipParams
    );

    const [distributionRows] = await db.query(
      `SELECT status, COUNT(*) AS count
       FROM applications
       WHERE created_by_cs_id = ?
          OR counselor_id = ?
          OR assigned_staff_id = ?
          OR ops_id = ?
       GROUP BY status`,
      applicationOwnershipParams
    );

    const [activeGoals] = await db.query(
      `SELECT id, title, goal_type, target_value, current_value, status, department, staff_id, created_at
       FROM goals
       WHERE staff_id = ?
         AND (
          (goal_type = 'milestone' AND status <> 'Completed')
          OR (goal_type = 'numeric' AND COALESCE(current_value, 0) < COALESCE(target_value, 0))
         )
       ORDER BY created_at DESC, id DESC`,
      [req.user.id]
    );

    const statusDistribution = Object.fromEntries(distributionRows.map(row => [row.status, Number(row.count || 0)]));

    res.json({
      total_orders: Number(orderRows[0]?.total_orders || 0),
      pending_tasks: Number(taskRows[0]?.pending_tasks || 0),
      active_goals: activeGoals,
      active_goals_count: activeGoals.length,
      status_distribution: statusDistribution,
      status_distribution_rows: distributionRows.map(row => ({ status: row.status, count: Number(row.count || 0) })),
      total_tasks: Number(taskRows[0]?.total_tasks || 0),
      completed_tasks: Number(taskRows[0]?.completed_tasks || 0),
      performance_score: Number(taskRows[0]?.performance_score || 0)
    });
  } catch (error) {
    console.error('Error in getMyStaffMetrics:', error);
    res.status(500).json({ message: 'Server error while fetching staff metrics' });
  }
};

export const getMyActiveActions = async (req, res) => {
  try {
    await ensureTaskColumns();
    await ensureMessagesTable();

    const [actorRows] = await db.query(
      'SELECT id, role, department, job_title FROM users WHERE id = ?',
      [req.user.id]
    );

    if (actorRows.length === 0) {
      return res.status(401).json({ message: 'Authenticated staff user was not found' });
    }

    const actor = actorRows[0];
    const department = normalizeDepartment(actor);
    const actions = [];

    const appConfig = applicationActionConfig[department];
    if (appConfig) {
      const params = [...appConfig.statuses];
      let ownershipSql = '';

      if (appConfig.ownerColumn) {
        ownershipSql = `AND ${appConfig.ownerColumn} = ?`;
        params.push(req.user.id);
      }

      const extraSql = '';

      const [applications] = await db.query(
        `SELECT
          a.id,
          a.app_uid,
          a.status,
          a.visa_progress,
          a.created_at,
          a.updated_at,
          student.full_name AS student_name
         FROM applications a
         JOIN users student ON a.student_id = student.id
         WHERE ((a.status IN (${appConfig.statuses.map(() => '?').join(', ')}) ${ownershipSql}) ${extraSql})
         ORDER BY COALESCE(a.updated_at, a.created_at) ASC`,
        params
      );

      applications.forEach((app) => {
        const title = appConfig.title(app);

        actions.push({
          id: `application-${app.id}-${app.status}`,
          type: 'application',
          title,
          subtitle: appConfig.subtitle(app),
          created_at: app.updated_at || app.created_at,
          app_uid: app.app_uid,
          application_id: app.id,
          action_link: `/staff/clients?openApp=${encodeURIComponent(app.app_uid || app.id)}`
        });
      });
    }

    if (department === 'Finance' || actor.role === 'admin') {
      const [invoices] = await db.query(
        `SELECT
          p.payment_id,
          p.description,
          p.amount,
          p.payment_status,
          p.created_at,
          p.due_date,
          client.full_name AS client_name
         FROM payments p
         LEFT JOIN users client ON p.client_id = client.id
         WHERE p.payment_status IN ('Pending Verification', 'pending', 'Pending')
         ORDER BY COALESCE(p.created_at, p.due_date) ASC`
      );

      invoices.forEach((invoice) => {
        actions.push({
          id: `invoice-${invoice.payment_id}`,
          type: 'invoice',
          title: invoice.payment_status === 'Pending Verification'
            ? `Verify Payment Receipt #${invoice.payment_id}`
            : `Follow Up Invoice #${invoice.payment_id}`,
          subtitle: `${invoice.client_name || 'Client'} - ${invoice.description || 'Invoice'} - $${Number(invoice.amount || 0).toFixed(2)}`,
          created_at: invoice.created_at || invoice.due_date,
          invoice_id: invoice.payment_id,
          action_link: `/staff/invoices?highlight=${invoice.payment_id}`
        });
      });
    }

    const [messages] = await db.query(
      `SELECT
        m.id,
        m.sender_id,
        m.message,
        m.image_url,
        m.created_at,
        sender.full_name AS sender_name
       FROM messages m
       JOIN users sender ON m.sender_id = sender.id
       WHERE m.receiver_id = ? AND m.is_read = FALSE
       ORDER BY m.created_at ASC`,
      [req.user.id]
    );

    messages.forEach((message) => {
      actions.push({
        id: `message-${message.id}`,
        type: 'message',
        title: `Unread message from ${message.sender_name || 'Client'}`,
        subtitle: message.message || (message.image_url ? 'Image attachment' : 'New message'),
        created_at: message.created_at,
        sender_id: message.sender_id,
        action_link: `/staff/messages?userId=${message.sender_id}`
      });
    });

    const [tasks] = await db.query(
      `SELECT
        t.task_id,
        t.task_title,
        t.description,
        t.created_at,
        t.due_date,
        t.application_id,
        a.app_uid
       FROM tasks t
       LEFT JOIN applications a ON t.application_id = a.id
       WHERE t.assigned_to = ? AND LOWER(t.task_status) <> 'completed'
       ORDER BY COALESCE(t.created_at, t.due_date) ASC, t.task_id ASC`,
      [req.user.id]
    );

    tasks.forEach((task) => {
      actions.push({
        id: `task-${task.task_id}`,
        task_id: task.task_id,
        type: task.app_uid ? 'application' : 'system',
        app_uid: task.app_uid,
        application_id: task.application_id,
        title: task.task_title || 'Assigned Task',
        subtitle: task.app_uid ? `${task.description || 'System task'} - ${task.app_uid}` : (task.description || 'System task'),
        created_at: task.created_at || task.due_date,
        action_link: task.app_uid
          ? `/staff/clients?openApp=${encodeURIComponent(task.app_uid)}`
          : '/staff'
      });
    });

    actions.sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
    res.json(actions);
  } catch (error) {
    console.error('Error in getMyActiveActions:', error);
    res.status(500).json({ message: 'Server error while fetching active actions', error: error.message });
  }
};

// @desc    Create a new staff member
// @route   POST /api/staff
// @access  Private/Admin
export const createStaff = async (req, res) => {
  const connection = await db.getConnection();

  try {
    await ensureStaffDetailsTable(connection);
    await ensureUserMonthlySalaryColumn(connection);

    const {
      full_name,
      gender,
      phone,
      email,
      address,
      department,
      job_title,
      staff_status,
      monthly_salary,
      hire_date,
      password
    } = req.body;

    if (!full_name || !email || !password || !department || !job_title) {
      return res.status(400).json({ message: 'Full name, email, password, department, and job title are required' });
    }

    await connection.beginTransaction();

    const [existingUsers] = await connection.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existingUsers.length > 0) {
      await connection.rollback();
      return res.status(400).json({ message: 'A user with this email already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const [userResult] = await connection.query(
      `INSERT INTO users (full_name, email, password, role, department, job_title, staff_status, performance, monthly_salary)
       VALUES (?, ?, ?, 'staff', ?, ?, ?, 'Pending', ?)`,
      [full_name, email, hashedPassword, department, job_title, staff_status || 'Active', monthly_salary || 0]
    );

    const userId = userResult.insertId;

    await connection.query(
      `INSERT INTO staff_details (user_id, gender, phone, address, monthly_salary, hire_date)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, gender || null, phone || null, address || null, monthly_salary || null, hire_date || null]
    );

    await connection.commit();

    res.status(201).json({
      message: 'Staff member created successfully',
      userId
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error in createStaff:', error);
    res.status(500).json({ message: 'Server error while creating staff member' });
  } finally {
    connection.release();
  }
};

// @desc    Update a staff member
// @route   PUT /api/staff/:id
// @access  Private/Admin
export const updateStaff = async (req, res) => {
  const connection = await db.getConnection();

  try {
    await ensureStaffDetailsTable(connection);
    await ensureUserStarredColumn(connection);
    await ensureUserMonthlySalaryColumn(connection);

    const staffId = req.params.id;
    const {
      full_name,
      gender,
      phone,
      email,
      address,
      department,
      job_title,
      staff_status,
      monthly_salary,
      hire_date
    } = req.body;

    if (!full_name || !email || !department || !job_title) {
      return res.status(400).json({ message: 'Full name, email, department, and job title are required' });
    }

    await connection.beginTransaction();

    const [existingStaff] = await connection.query(
      "SELECT id FROM users WHERE id = ? AND role = 'staff'",
      [staffId]
    );

    if (existingStaff.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Staff member not found' });
    }

    const [emailConflicts] = await connection.query(
      'SELECT id FROM users WHERE email = ? AND id <> ?',
      [email, staffId]
    );

    if (emailConflicts.length > 0) {
      await connection.rollback();
      return res.status(400).json({ message: 'A user with this email already exists' });
    }

    await connection.query(
      `UPDATE users
       SET full_name = ?, email = ?, department = ?, job_title = ?, staff_status = ?, monthly_salary = ?
       WHERE id = ? AND role = 'staff'`,
      [full_name, email, department, job_title, staff_status || 'Active', monthly_salary || 0, staffId]
    );

    await connection.query(
      `INSERT INTO staff_details (user_id, gender, phone, address, monthly_salary, hire_date)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
        gender = VALUES(gender),
        phone = VALUES(phone),
        address = VALUES(address),
        monthly_salary = VALUES(monthly_salary),
        hire_date = VALUES(hire_date)`,
      [staffId, gender || null, phone || null, address || null, monthly_salary || null, hire_date || null]
    );

    await connection.commit();
    res.json({ message: 'Staff member updated successfully' });
  } catch (error) {
    try {
      await connection.rollback();
    } catch (rollbackError) {
      console.error('Rollback failed:', rollbackError);
    }
    console.error('Error in updateStaff:', error);
    res.status(500).json({ message: 'Server error while updating staff member' });
  } finally {
    connection.release();
  }
};

// @desc    Toggle starred staff flag
// @route   PUT /api/staff/:id/star
// @access  Private/Admin
export const toggleStaffStar = async (req, res) => {
  try {
    await ensureUserStarredColumn();

    const staffId = req.params.id;
    const [staff] = await db.query(
      "SELECT id, is_starred FROM users WHERE id = ? AND role = 'staff'",
      [staffId]
    );

    if (staff.length === 0) {
      return res.status(404).json({ message: 'Staff member not found' });
    }

    const nextStarred = !Boolean(staff[0].is_starred);
    await db.query('UPDATE users SET is_starred = ? WHERE id = ?', [nextStarred, staffId]);

    res.json({ message: 'Staff star status updated', is_starred: nextStarred });
  } catch (error) {
    console.error('Error in toggleStaffStar:', error);
    res.status(500).json({ message: 'Server error while updating staff star status' });
  }
};

export const getUserProfile = async (req, res) => {
  try {
    await ensureUserProfileImageColumn();
    const userId = req.user.id;
    let [users] = await db.query('SELECT id, full_name, email, role, department, job_title, profile_image_url FROM users WHERE id = ?', [userId]);
    
    if (users.length === 0) return res.status(404).json({ message: 'User not found' });
    
    let user = users[0];
    
    if (user.role === 'client') {
      const [students] = await db.query('SELECT phone, passport_no, nationality FROM students WHERE user_id = ?', [userId]);
      if (students.length > 0) user = { ...user, ...students[0] };
    }
    
    res.json(user);
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const updateUserProfile = async (req, res) => {
  try {
    await ensureUserProfileImageColumn();
    const userId = req.user.id;
    const { full_name, email, password, phone } = req.body;
    
    await db.query('UPDATE users SET full_name = ?, email = ? WHERE id = ?', [full_name, email, userId]);
    
    if (password) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      await db.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, userId]);
    }
    
    if (req.user.role === 'client' && phone !== undefined) {
      const [students] = await db.query('SELECT user_id FROM students WHERE user_id = ?', [userId]);
      if (students.length > 0) {
        await db.query('UPDATE students SET phone = ? WHERE user_id = ?', [phone, userId]);
      } else {
        await db.query('INSERT INTO students (user_id, phone) VALUES (?, ?)', [userId, phone]);
      }
    }
    
    res.json({ message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const updateProfileImage = async (req, res) => {
  try {
    await ensureUserProfileImageColumn();

    const userId = req.params.id;

    if (String(req.user.id) !== String(userId) && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to update this profile image' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'Profile image is required' });
    }

    const imageUrl = toPublicFilePath(req.file.path);
    const [result] = await db.query('UPDATE users SET profile_image_url = ? WHERE id = ?', [imageUrl, userId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: 'Profile image updated successfully', profile_image_url: imageUrl });
  } catch (error) {
    console.error('Error updating profile image:', error);
    res.status(500).json({ message: 'Server error while updating profile image' });
  }
};

// @desc    Delete a user
// @route   DELETE /api/users/:id
// @access  Private/Admin
export const deleteUser = async (req, res) => {
  try {
    const userId = req.params.id;

    if (userId === req.user.id.toString()) {
      return res.status(400).json({ message: 'Cannot delete your own account' });
    }

    const [result] = await db.query('DELETE FROM users WHERE id = ?', [userId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: 'User removed completely' });
  } catch (error) {
    console.error('Error in deleteUser:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
