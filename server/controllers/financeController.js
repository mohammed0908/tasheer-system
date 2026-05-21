import db from '../config/db.js';

export const ensureExpensesTable = async (connection = db) => {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS expenses (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      amount DECIMAL(10, 2) NOT NULL,
      date DATE NOT NULL,
      category VARCHAR(100) DEFAULT 'General',
      source VARCHAR(100) DEFAULT NULL,
      source_month VARCHAR(7) DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const statements = [
    'ALTER TABLE expenses ADD COLUMN source VARCHAR(100) DEFAULT NULL',
    'ALTER TABLE expenses ADD COLUMN source_month VARCHAR(7) DEFAULT NULL',
    'ALTER TABLE expenses ADD COLUMN staff_id INT DEFAULT NULL'
  ];

  for (const statement of statements) {
    try {
      await connection.query(statement);
    } catch (error) {
      if (error.code !== 'ER_DUP_FIELDNAME') throw error;
    }
  }
};

const ensurePayrollTables = async (connection = db) => {
  await ensureExpensesTable(connection);

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

  try {
    await connection.query('ALTER TABLE users ADD COLUMN monthly_salary DECIMAL(10, 2) DEFAULT 0');
  } catch (error) {
    if (error.code !== 'ER_DUP_FIELDNAME') throw error;
  }
};

const activePayrollWhere = `
  u.role = 'staff'
  AND LOWER(COALESCE(u.department, '')) <> 'admin'
`;

const payrollSalaryExpression = 'COALESCE(u.monthly_salary, sd.monthly_salary, 0)';

export const getPayrollStaff = async (req, res) => {
  try {
    await ensurePayrollTables();

    const [staff] = await db.query(`
      SELECT
        u.id,
        u.full_name,
        u.email,
        u.department,
        u.job_title,
        u.staff_status,
        ${payrollSalaryExpression} AS monthly_salary
      FROM users u
      LEFT JOIN staff_details sd ON u.id = sd.user_id
      WHERE ${activePayrollWhere}
      ORDER BY u.full_name ASC
    `);

    res.json(staff.map(member => ({
      ...member,
      monthly_salary: Number(member.monthly_salary || 0)
    })));
  } catch (error) {
    console.error('Error in getPayrollStaff:', error);
    res.status(500).json({ message: 'Server error while fetching payroll staff' });
  }
};

export const getFinanceSummary = async (req, res) => {
  try {
    await ensurePayrollTables();

    const [incomeRows] = await db.query(`
      SELECT COALESCE(SUM(amount), 0) AS total_income
      FROM payments
      WHERE LOWER(payment_status) IN ('paid', 'completed')
    `);

    const [expenseRows] = await db.query('SELECT COALESCE(SUM(amount), 0) AS total_outgoing FROM expenses');

    const [salaryRows] = await db.query(`
      SELECT COALESCE(SUM(${payrollSalaryExpression}), 0) AS current_active_payroll
      FROM users u
      LEFT JOIN staff_details sd ON u.id = sd.user_id
      WHERE ${activePayrollWhere}
    `);

    const [monthlyRows] = await db.query(`
      SELECT
        month_key,
        month_label,
        SUM(incoming) AS incoming,
        SUM(expenses) AS expenses,
        SUM(salaries) AS salaries,
        SUM(outgoing) AS outgoing,
        SUM(incoming) - SUM(outgoing) AS net_profit
      FROM (
        SELECT
          DATE_FORMAT(COALESCE(payment_date, verified_at, created_at), '%Y-%m') AS month_key,
          DATE_FORMAT(COALESCE(payment_date, verified_at, created_at), '%b %Y') AS month_label,
          SUM(amount) AS incoming,
          0 AS expenses,
          0 AS salaries,
          0 AS outgoing
        FROM payments
        WHERE LOWER(payment_status) IN ('paid', 'completed')
        GROUP BY DATE_FORMAT(COALESCE(payment_date, verified_at, created_at), '%Y-%m'), DATE_FORMAT(COALESCE(payment_date, verified_at, created_at), '%b %Y')

        UNION ALL

        SELECT
          DATE_FORMAT(date, '%Y-%m') AS month_key,
          DATE_FORMAT(date, '%b %Y') AS month_label,
          0 AS incoming,
          SUM(CASE WHEN category IN ('Salaries', 'Payroll') THEN 0 ELSE amount END) AS expenses,
          SUM(CASE WHEN category IN ('Salaries', 'Payroll') THEN amount ELSE 0 END) AS salaries,
          SUM(amount) AS outgoing
        FROM expenses
        GROUP BY DATE_FORMAT(date, '%Y-%m'), DATE_FORMAT(date, '%b %Y')
      ) finance_months
      WHERE month_key IS NOT NULL
      GROUP BY month_key, month_label
      ORDER BY month_key ASC
    `);

    const [invoices] = await db.query(`
      SELECT
        p.payment_id,
        p.amount,
        p.description,
        p.payment_status,
        p.payment_date,
        p.due_date,
        p.verified_at,
        p.receipt_path,
        u.full_name AS client_name
      FROM payments p
      LEFT JOIN applications a ON p.application_id = a.id
      LEFT JOIN users u ON COALESCE(p.client_id, a.student_id) = u.id
      ORDER BY COALESCE(p.payment_date, p.created_at) DESC, p.payment_id DESC
    `);

    const [expenses] = await db.query(`
      SELECT e.id, e.title, e.amount, e.date, e.category, e.source, e.source_month, e.staff_id, u.full_name AS staff_name, e.created_at
      FROM expenses e
      LEFT JOIN users u ON e.staff_id = u.id
      ORDER BY e.date DESC, e.id DESC
    `);

    const totalIncome = Number(incomeRows[0]?.total_income || 0);
    const totalOutgoing = Number(expenseRows[0]?.total_outgoing || 0);
    const currentActivePayroll = Number(salaryRows[0]?.current_active_payroll || 0);
    const netProfit = totalIncome - totalOutgoing;

    res.json({
      totalIncome,
      totalIncoming: totalIncome,
      totalExpenses: totalOutgoing,
      baseExpenses: totalOutgoing,
      totalOutgoing,
      total_outgoing: totalOutgoing,
      totalSalaries: currentActivePayroll,
      currentSalaryObligation: currentActivePayroll,
      currentActivePayroll,
      current_active_payroll: currentActivePayroll,
      recordedSalaries: 0,
      netRevenue: netProfit,
      netProfit,
      monthly: monthlyRows.map(row => ({
        month_key: row.month_key,
        month: row.month_label,
        incoming: Number(row.incoming || 0),
        expenses: Number(row.expenses || 0),
        salaries: Number(row.salaries || 0),
        outgoing: Number(row.outgoing || 0),
        net_profit: Number(row.net_profit || 0)
      })),
      invoices,
      expenses
    });
  } catch (error) {
    console.error('Error in getFinanceSummary:', error);
    res.status(500).json({ message: 'Server error while fetching finance summary' });
  }
};

export const createExpense = async (req, res) => {
  try {
    await ensureExpensesTable();

    const { title, amount, date, category = 'General' } = req.body;

    if (!title?.trim() || !amount || !date) {
      return res.status(400).json({ message: 'Title, amount, and date are required' });
    }

    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ message: 'Amount must be greater than 0' });
    }

    const [result] = await db.query(
      'INSERT INTO expenses (title, amount, date, category) VALUES (?, ?, ?, ?)',
      [title.trim(), parsedAmount, date, category || 'General']
    );

    const [expenses] = await db.query('SELECT id, title, amount, date, category, created_at FROM expenses WHERE id = ?', [result.insertId]);
    res.status(201).json(expenses[0]);
  } catch (error) {
    console.error('Error in createExpense:', error);
    res.status(500).json({ message: 'Server error while creating expense' });
  }
};

const monthName = (month, year) => new Date(Date.UTC(year, month - 1, 1)).toLocaleString('en-US', { month: 'long' });

export const recordSalaries = async (req, res) => {
  try {
    await ensurePayrollTables();

    let { month, year, staff_id, amount: requestedAmount } = req.body;

    if (typeof month === 'string' && /^\d{4}-\d{2}$/.test(month)) {
      const [parsedYear, parsedMonth] = month.split('-').map(Number);
      year = parsedYear;
      month = parsedMonth;
    }

    const parsedMonth = Number(month);
    const parsedYear = Number(year);
    const staffId = staff_id ? Number(staff_id) : null;
    if (!Number.isInteger(parsedMonth) || parsedMonth < 1 || parsedMonth > 12 || !Number.isInteger(parsedYear) || parsedYear < 2000) {
      return res.status(400).json({ message: 'Valid month and year are required.' });
    }
    if (staff_id && !Number.isInteger(staffId)) {
      return res.status(400).json({ message: 'Valid staff member is required.' });
    }

    const sourceMonth = `${parsedYear}-${String(parsedMonth).padStart(2, '0')}`;
    const date = `${sourceMonth}-01`;
    const overrideAmount = requestedAmount !== undefined && requestedAmount !== ''
      ? Number(requestedAmount)
      : null;

    if (overrideAmount !== null && (!Number.isFinite(overrideAmount) || overrideAmount <= 0)) {
      return res.status(400).json({ message: 'Salary amount must be greater than 0.' });
    }

    let amount = 0;
    let staffCount = 0;
    let staffName = '';
    let title = `Payroll - ${monthName(parsedMonth, parsedYear)} ${parsedYear}`;

    if (staffId) {
      const [staffRows] = await db.query(`
        SELECT u.id, u.full_name, ${payrollSalaryExpression} AS monthly_salary
        FROM users u
        LEFT JOIN staff_details sd ON u.id = sd.user_id
        WHERE u.id = ?
          AND ${activePayrollWhere}
        LIMIT 1
      `, [staffId]);

      if (staffRows.length === 0) {
        return res.status(404).json({ message: 'Staff member not found in Staff Management.' });
      }

      amount = overrideAmount || Number(staffRows[0]?.monthly_salary || 0);
      staffCount = 1;
      staffName = staffRows[0].full_name;
      title = `Payroll - ${staffName} - ${monthName(parsedMonth, parsedYear)} ${parsedYear}`;

      if (overrideAmount) {
        await db.query('UPDATE users SET monthly_salary = ? WHERE id = ? AND role = \'staff\'', [overrideAmount, staffId]);
        await db.query(
          `INSERT INTO staff_details (user_id, monthly_salary)
           VALUES (?, ?)
           ON DUPLICATE KEY UPDATE monthly_salary = VALUES(monthly_salary)`,
          [staffId, overrideAmount]
        );
      }
    } else {
      const [salaryRows] = await db.query(`
        SELECT
          COALESCE(SUM(${payrollSalaryExpression}), 0) AS total_salaries,
          COUNT(*) AS staff_count
        FROM users u
        LEFT JOIN staff_details sd ON u.id = sd.user_id
        WHERE ${activePayrollWhere}
      `);

      amount = Number(salaryRows[0]?.total_salaries || 0);
      staffCount = Number(salaryRows[0]?.staff_count || 0);
    }

    if (amount <= 0) {
      return res.status(400).json({ message: staffId ? 'This staff member has no monthly salary configured in Staff Management.' : 'No staff salaries are configured in Staff Management.' });
    }

    const [existingRows] = await db.query(
      "SELECT id FROM expenses WHERE title = ? OR (source = 'staff_salaries' AND source_month = ? AND ((staff_id = ?) OR (? IS NULL AND staff_id IS NULL))) LIMIT 1",
      [title, sourceMonth, staffId, staffId]
    );

    if (existingRows.length > 0) {
      return res.status(400).json({ message: staffId ? 'Salary for this staff member has already been recorded for this month.' : 'Salaries for this month have already been recorded.' });
    }

    const [result] = await db.query(
      "INSERT INTO expenses (title, amount, date, category, source, source_month, staff_id) VALUES (?, ?, ?, 'Payroll', 'staff_salaries', ?, ?)",
      [title, amount, date, sourceMonth, staffId]
    );

    const [expenses] = await db.query(`
      SELECT e.id, e.title, e.amount, e.date, e.category, e.source, e.source_month, e.staff_id, u.full_name AS staff_name, e.created_at
      FROM expenses e
      LEFT JOIN users u ON e.staff_id = u.id
      WHERE e.id = ?
    `, [result.insertId]);
    res.status(200).json({ ...expenses[0], staff_count: staffCount, staff_name: expenses[0]?.staff_name || staffName });
  } catch (error) {
    console.error('Error in recordSalaries:', error);
    res.status(500).json({ message: 'Server error while recording salary expense' });
  }
};

export const createSalaryExpense = recordSalaries;
