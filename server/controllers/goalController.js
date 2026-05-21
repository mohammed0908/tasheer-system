import db from '../config/db.js';

const allowedGoalTypes = new Set(['numeric', 'milestone']);
const allowedStatuses = new Set(['Not Started', 'In Progress', 'Completed']);

const toNumber = (value, fallback = null) => {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
};

const addColumnIfMissing = async (connection, column, definition) => {
  try {
    await connection.query(`ALTER TABLE goals ADD COLUMN ${column} ${definition}`);
  } catch (error) {
    if (error.code !== 'ER_DUP_FIELDNAME') throw error;
  }
};

export const ensureGoalsTable = async (connection = db) => {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS goals (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      goal_type ENUM('numeric', 'milestone') DEFAULT 'numeric',
      target_value DECIMAL(12, 2) DEFAULT NULL,
      current_value DECIMAL(12, 2) DEFAULT NULL,
      status ENUM('Not Started', 'In Progress', 'Completed') DEFAULT 'Not Started',
      department VARCHAR(100) DEFAULT 'All Departments',
      staff_id INT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await addColumnIfMissing(connection, 'goal_type', "ENUM('numeric', 'milestone') DEFAULT 'numeric'");
  await addColumnIfMissing(connection, 'target_value', 'DECIMAL(12, 2) DEFAULT NULL');
  await addColumnIfMissing(connection, 'current_value', 'DECIMAL(12, 2) DEFAULT NULL');
  await addColumnIfMissing(connection, 'status', "ENUM('Not Started', 'In Progress', 'Completed') DEFAULT 'Not Started'");
  await addColumnIfMissing(connection, 'department', "VARCHAR(100) DEFAULT 'All Departments'");
  await addColumnIfMissing(connection, 'staff_id', 'INT DEFAULT NULL');
  const [constraints] = await connection.query(
    `SELECT CONSTRAINT_NAME
     FROM information_schema.TABLE_CONSTRAINTS
     WHERE CONSTRAINT_SCHEMA = DATABASE()
       AND TABLE_NAME = 'goals'
       AND CONSTRAINT_NAME = 'fk_goals_staff'
     LIMIT 1`
  );

  if (constraints.length === 0) {
    try {
      await connection.query('ALTER TABLE goals ADD CONSTRAINT fk_goals_staff FOREIGN KEY (staff_id) REFERENCES users(id) ON DELETE SET NULL');
    } catch (error) {
      const isDuplicateConstraint = ['ER_DUP_KEYNAME', 'ER_FK_DUP_NAME', 'ER_CANT_CREATE_TABLE'].includes(error.code) &&
        String(error.sqlMessage || '').toLowerCase().includes('duplicate key');
      if (!isDuplicateConstraint) throw error;
    }
  }

  await connection.query('ALTER TABLE goals MODIFY target_value DECIMAL(12, 2) DEFAULT NULL');
  await connection.query('ALTER TABLE goals MODIFY current_value DECIMAL(12, 2) DEFAULT NULL');
  await connection.query("UPDATE goals SET goal_type = 'numeric' WHERE goal_type IS NULL");
  await connection.query("UPDATE goals SET status = 'Not Started' WHERE status IS NULL");
  await connection.query("UPDATE goals SET department = 'All Departments' WHERE department IS NULL OR department = ''");
};

const selectGoalById = async (id) => {
  const [goals] = await db.query(
    `SELECT g.id, g.title, g.goal_type, g.target_value, g.current_value, g.status, g.department, g.staff_id, u.full_name AS staff_name, g.created_at
     FROM goals g
     LEFT JOIN users u ON g.staff_id = u.id
     WHERE g.id = ?`,
    [id]
  );
  return goals[0];
};

export const getGoals = async (req, res) => {
  try {
    await ensureGoalsTable();

    const params = [];
    const whereSql = req.user?.role === 'staff'
      ? 'WHERE g.staff_id IS NULL OR g.staff_id = ?'
      : '';
    if (req.user?.role === 'staff') params.push(req.user.id);

    const [goals] = await db.query(
      `SELECT g.id, g.title, g.goal_type, g.target_value, g.current_value, g.status, g.department, g.staff_id, u.full_name AS staff_name, g.created_at
       FROM goals g
       LEFT JOIN users u ON g.staff_id = u.id
       ${whereSql}
       ORDER BY g.created_at DESC, g.id DESC`
      ,
      params
    );

    res.json(goals);
  } catch (error) {
    console.error('Error in getGoals:', error);
    res.status(500).json({ message: 'Server error while fetching goals' });
  }
};

export const createGoal = async (req, res) => {
  try {
    console.log('Incoming Goal Payload:', req.body);
    await ensureGoalsTable();

    const { title, goal_type = 'numeric', status = 'Not Started' } = req.body;
    const department = req.body.department?.trim() || 'All Departments';
    const staffId = req.body.staff_id ? Number(req.body.staff_id) : null;

    if (!title?.trim()) {
      return res.status(400).json({ message: 'Goal title is required' });
    }

    if (!allowedGoalTypes.has(goal_type)) {
      return res.status(400).json({ message: 'Invalid goal type' });
    }

    if (staffId) {
      const [staffRows] = await db.query("SELECT id FROM users WHERE id = ? AND role = 'staff'", [staffId]);
      if (staffRows.length === 0) {
        return res.status(400).json({ message: 'Assigned staff member was not found' });
      }
    }

    let targetValue = null;
    let currentValue = null;
    let statusValue = 'Not Started';

    if (goal_type === 'numeric') {
      targetValue = toNumber(req.body.target_value);
      currentValue = toNumber(req.body.current_value, 0);

      if (!Number.isFinite(targetValue) || targetValue <= 0) {
        return res.status(400).json({ message: 'Target value must be greater than 0' });
      }

      if (!Number.isFinite(currentValue) || currentValue < 0) {
        return res.status(400).json({ message: 'Current value cannot be negative' });
      }
    } else {
      if (!allowedStatuses.has(status)) {
        return res.status(400).json({ message: 'Invalid goal status' });
      }
      statusValue = status;
    }

    const [result] = await db.query(
      `INSERT INTO goals (title, goal_type, status, target_value, current_value, department, staff_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [title.trim(), goal_type, statusValue, targetValue, currentValue, department, staffId]
    );

    res.status(201).json(await selectGoalById(result.insertId));
  } catch (error) {
    console.error('Error in createGoal:', error);
    res.status(500).json({ message: 'Server error while creating goal' });
  }
};

export const updateGoal = async (req, res) => {
  try {
    await ensureGoalsTable();

    const { id } = req.params;
    const existingGoal = await selectGoalById(id);

    if (!existingGoal) {
      return res.status(404).json({ message: 'Goal not found' });
    }

    const nextType = req.body.goal_type || existingGoal.goal_type || 'numeric';

    if (!allowedGoalTypes.has(nextType)) {
      return res.status(400).json({ message: 'Invalid goal type' });
    }

    const updates = [];
    const params = [];

    if (req.body.title !== undefined) {
      if (!req.body.title.trim()) {
        return res.status(400).json({ message: 'Goal title cannot be empty' });
      }
      updates.push('title = ?');
      params.push(req.body.title.trim());
    }

    if (req.body.goal_type !== undefined) {
      updates.push('goal_type = ?');
      params.push(nextType);
    }

    if (req.body.department !== undefined) {
      updates.push('department = ?');
      params.push(req.body.department?.trim() || 'All Departments');
    }

    if (req.body.staff_id !== undefined) {
      const staffId = req.body.staff_id ? Number(req.body.staff_id) : null;
      if (staffId) {
        const [staffRows] = await db.query("SELECT id FROM users WHERE id = ? AND role = 'staff'", [staffId]);
        if (staffRows.length === 0) {
          return res.status(400).json({ message: 'Assigned staff member was not found' });
        }
      }
      updates.push('staff_id = ?');
      params.push(staffId);
    }

    if (nextType === 'numeric') {
      if (req.body.target_value !== undefined) {
        const targetValue = toNumber(req.body.target_value);
        if (!Number.isFinite(targetValue) || targetValue <= 0) {
          return res.status(400).json({ message: 'Target value must be greater than 0' });
        }
        updates.push('target_value = ?');
        params.push(targetValue);
      }

      if (req.body.current_value !== undefined) {
        const currentValue = toNumber(req.body.current_value);
        if (!Number.isFinite(currentValue) || currentValue < 0) {
          return res.status(400).json({ message: 'Current value cannot be negative' });
        }
        updates.push('current_value = ?');
        params.push(currentValue);
      }

      if (req.body.goal_type !== undefined) {
        updates.push('status = ?');
        params.push('Not Started');
      }
    } else {
      if (req.body.status !== undefined) {
        if (!allowedStatuses.has(req.body.status)) {
          return res.status(400).json({ message: 'Invalid goal status' });
        }
        updates.push('status = ?');
        params.push(req.body.status);
      }

      if (req.body.goal_type !== undefined) {
        updates.push('target_value = NULL', 'current_value = NULL');
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ message: 'No goal updates provided' });
    }

    params.push(id);

    await db.query(`UPDATE goals SET ${updates.join(', ')} WHERE id = ?`, params);

    res.json(await selectGoalById(id));
  } catch (error) {
    console.error('Error in updateGoal:', error);
    res.status(500).json({ message: 'Server error while updating goal' });
  }
};

export const deleteGoal = async (req, res) => {
  try {
    await ensureGoalsTable();

    const { id } = req.params;
    const [result] = await db.query('DELETE FROM goals WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Goal not found' });
    }

    res.json({ message: 'Goal deleted successfully' });
  } catch (error) {
    console.error('Error in deleteGoal:', error);
    res.status(500).json({ message: 'Server error while deleting goal' });
  }
};
