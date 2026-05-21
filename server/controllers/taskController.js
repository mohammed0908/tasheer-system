import db from '../config/db.js';

export const ensureTaskColumns = async (connection = db) => {
  const columns = [
    { name: 'description', sql: 'ALTER TABLE tasks ADD COLUMN description TEXT' },
    { name: 'priority', sql: "ALTER TABLE tasks ADD COLUMN priority ENUM('Low', 'Medium', 'High') DEFAULT 'Medium'" },
    { name: 'application_id', sql: 'ALTER TABLE tasks ADD COLUMN application_id INT DEFAULT NULL' },
    { name: 'created_at', sql: 'ALTER TABLE tasks ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP' }
  ];

  for (const column of columns) {
    try {
      await connection.query(column.sql);
    } catch (error) {
      if (error.code !== 'ER_DUP_FIELDNAME') {
        throw error;
      }
    }
  }

  await connection.query(
    "ALTER TABLE tasks MODIFY COLUMN task_status ENUM('pending', 'in-progress', 'completed', 'waiting', 'need-help') DEFAULT 'pending'"
  );

  try {
    await connection.query(
      'ALTER TABLE tasks ADD CONSTRAINT fk_tasks_application FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE SET NULL'
    );
  } catch (error) {
    const isDuplicateForeignKey =
      ['ER_DUP_KEYNAME', 'ER_FK_DUP_NAME'].includes(error.code) ||
      (error.code === 'ER_CANT_CREATE_TABLE' && Number(error.errno) === 1005 && error.message.includes('errno: 121'));

    if (!isDuplicateForeignKey) {
      throw error;
    }
  }
};

const normalizeStatusForDb = (status) => {
  if (!status) return 'pending';
  const normalized = status.toLowerCase();
  if (normalized === 'done' || normalized === 'completed') return 'completed';
  if (normalized === 'in progress') return 'in-progress';
  if (normalized === 'waiting' || normalized === 'waiting for confirmation') return 'waiting';
  if (normalized === 'need help' || normalized === 'need-help') return 'need-help';
  return ['pending', 'in-progress', 'completed', 'waiting', 'need-help'].includes(normalized) ? normalized : 'pending';
};

export const ensureNotificationsTable = async (connection = db) => {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      message VARCHAR(255) NOT NULL,
      type VARCHAR(100) NOT NULL,
      application_id INT DEFAULT NULL,
      app_uid VARCHAR(50) DEFAULT NULL,
      target_url VARCHAR(255) DEFAULT NULL,
      is_read BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  const columns = [
    'ALTER TABLE notifications ADD COLUMN application_id INT DEFAULT NULL',
    'ALTER TABLE notifications ADD COLUMN app_uid VARCHAR(50) DEFAULT NULL',
    'ALTER TABLE notifications ADD COLUMN target_url VARCHAR(255) DEFAULT NULL'
  ];

  for (const statement of columns) {
    try {
      await connection.query(statement);
    } catch (error) {
      if (error.code !== 'ER_DUP_FIELDNAME') throw error;
    }
  }
};

export const getAllTasks = async (req, res) => {
  try {
    await ensureTaskColumns();

    const [tasks] = await db.query(`
      SELECT 
        t.*,
        t.task_id,
        t.task_title,
        t.description,
        t.task_status, 
        t.priority,
        t.due_date, 
        t.assigned_to,
        t.application_id,
        a.app_uid,
        a.status AS application_status,
        u.full_name AS assigned_staff,
        u.full_name AS assigned_staff_name
      FROM tasks t 
      LEFT JOIN users u ON t.assigned_to = u.id
      LEFT JOIN applications a ON t.application_id = a.id
      ORDER BY t.task_id DESC
    `);
    
    res.json(tasks);
  } catch (error) {
    console.error('Error in getAllTasks:', error);
    res.status(500).json({ message: 'Server error while fetching tasks' });
  }
};

export const getMyTasks = async (req, res) => {
  try {
    await ensureTaskColumns();

    const [tasks] = await db.query(
      `SELECT 
        t.*,
        t.task_id AS id,
        t.task_title AS title,
        t.task_status AS status,
        t.application_id,
        a.app_uid,
        a.status AS application_status
       FROM tasks t
       LEFT JOIN applications a ON t.application_id = a.id
       WHERE t.assigned_to = ?
       ORDER BY
        CASE WHEN t.task_status = 'completed' THEN 1 ELSE 0 END,
        t.due_date IS NULL,
        t.due_date ASC,
        t.task_id DESC`,
      [req.user.id]
    );

    res.json(tasks);
  } catch (error) {
    console.error('Error in getMyTasks:', error);
    res.status(500).json({ message: 'Server error while fetching staff tasks' });
  }
};

export const updateMyTaskStatus = async (req, res) => {
  try {
    await ensureTaskColumns();

    const status = normalizeStatusForDb(req.body.status);
    const [result] = await db.query(
      'UPDATE tasks SET task_status = ? WHERE task_id = ? AND assigned_to = ?',
      [status, req.params.id, req.user.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Task not found' });
    }

    res.json({ message: 'Task status updated successfully' });
  } catch (error) {
    console.error('Error in updateMyTaskStatus:', error);
    res.status(500).json({ message: 'Server error while updating task status' });
  }
};

export const completeTask = async (req, res) => {
  try {
    await ensureTaskColumns();

    const [tasks] = await db.query(
      'SELECT task_id, assigned_to FROM tasks WHERE task_id = ?',
      [req.params.id]
    );

    if (tasks.length === 0) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const task = tasks[0];
    if (req.user.role !== 'admin' && Number(task.assigned_to) !== Number(req.user.id)) {
      return res.status(403).json({ message: 'Only the assigned staff member or an admin can complete this task' });
    }

    await db.query(
      "UPDATE tasks SET task_status = 'completed' WHERE task_id = ?",
      [req.params.id]
    );

    res.json({ message: 'Task completed successfully' });
  } catch (error) {
    console.error('Error in completeTask:', error);
    res.status(500).json({ message: 'Server error while completing task' });
  }
};

export const updateTask = async (req, res) => {
  try {
    await ensureTaskColumns();

    const { title, description, assigned_to, due_date, priority, status } = req.body;

    if (!title || !assigned_to) {
      return res.status(400).json({ message: 'Task title and assigned staff are required' });
    }

    const [result] = await db.query(
      `UPDATE tasks
       SET task_title = ?, description = ?, assigned_to = ?, due_date = ?, priority = ?, task_status = ?
       WHERE task_id = ?`,
      [
        title,
        description || null,
        assigned_to,
        due_date || null,
        priority || 'Medium',
        normalizeStatusForDb(status),
        req.params.id
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Task not found' });
    }

    res.json({ message: 'Task updated successfully' });
  } catch (error) {
    console.error('Error in updateTask:', error);
    res.status(500).json({ message: 'Server error while updating task' });
  }
};

export const deleteTask = async (req, res) => {
  try {
    const [result] = await db.query('DELETE FROM tasks WHERE task_id = ?', [req.params.id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Task not found' });
    }

    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Error in deleteTask:', error);
    res.status(500).json({ message: 'Server error while deleting task' });
  }
};

export const createTask = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const { title, description, assigned_to, due_date, priority, application_id } = req.body;

    if (!title || !assigned_to) {
      return res.status(400).json({ message: 'Task title and assigned staff are required' });
    }

    await connection.beginTransaction();
    await ensureTaskColumns(connection);
    await ensureNotificationsTable(connection);

    const [staff] = await connection.query(
      "SELECT id FROM users WHERE id = ? AND role = 'staff'",
      [assigned_to]
    );

    if (staff.length === 0) {
      await connection.rollback();
      return res.status(400).json({ message: 'Assigned staff member was not found' });
    }

    const [taskResult] = await connection.query(
      `INSERT INTO tasks (task_title, description, assigned_to, due_date, priority, task_status, application_id)
       VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
      [title, description || null, assigned_to, due_date || null, priority || 'Medium', application_id || null]
    );

    let taskAppUid = null;
    if (application_id) {
      const [applications] = await connection.query('SELECT app_uid FROM applications WHERE id = ?', [application_id]);
      taskAppUid = applications[0]?.app_uid || null;
    }

    await connection.query(
      `INSERT INTO notifications (user_id, message, type, application_id, app_uid, target_url, is_read)
       VALUES (?, ?, 'task_assignment', ?, ?, ?, FALSE)`,
      [
        assigned_to,
        `You have been assigned a new task: ${title}`,
        application_id || null,
        taskAppUid,
        taskAppUid ? `/staff/clients?openApp=${encodeURIComponent(taskAppUid)}` : '/staff'
      ]
    );

    await connection.commit();

    res.status(201).json({
      message: 'Task created successfully',
      taskId: taskResult.insertId
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error in createTask:', error);
    res.status(500).json({ message: 'Server error while creating task' });
  } finally {
    connection.release();
  }
};
