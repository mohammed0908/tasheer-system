import db from '../config/db.js';

// @desc    Get comprehensive admin analytics
// @route   GET /api/dashboard/analytics
// @access  Private/Admin
export const getAdminAnalytics = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const selectedYear = Number(req.query.year || new Date().getFullYear());
    
    // 1. KPIs
    const [[{ totalOrders }]] = await connection.query('SELECT COUNT(*) as totalOrders FROM applications');
    const [[{ successfulVisas }]] = await connection.query("SELECT COUNT(*) as successfulVisas FROM applications WHERE status = 'VISA_COMPLETED'");
    const [[{ completedFiles }]] = await connection.query("SELECT COUNT(*) as completedFiles FROM applications WHERE status = 'VISA_COMPLETED'");
    const monthlyRevenue = 0; // Financial tables not yet implemented
    
    // 2. Monthly Trend (Line Chart)
    const [monthlyRows] = await connection.query(`
      SELECT MONTH(created_at) AS month_number, COUNT(*) AS applications
      FROM applications
      WHERE YEAR(created_at) = ?
      GROUP BY MONTH(created_at)
    `, [selectedYear]);
    const monthlyCounts = Object.fromEntries(monthlyRows.map(row => [Number(row.month_number), Number(row.applications || 0)]));
    const monthFormatter = new Intl.DateTimeFormat('en-US', { month: 'short' });
    const monthlyTrend = Array.from({ length: 12 }, (_, index) => {
      const monthNumber = index + 1;
      return {
        name: monthFormatter.format(new Date(selectedYear, index, 1)),
        month: monthNumber,
        year: selectedYear,
        applications: monthlyCounts[monthNumber] || 0
      };
    });

    // 3. Status Distribution (Donut Chart)
    const [statusDist] = await connection.query('SELECT status as name, COUNT(*) as value FROM applications GROUP BY status');
    const statusDistribution = statusDist.map(item => ({
      name: item.name.charAt(0).toUpperCase() + item.name.slice(1),
      value: parseInt(item.value)
    }));

    // 4. Program Distribution (Bar Chart)
    const [progDistRaw] = await connection.query('SELECT program_name, COUNT(*) as count FROM applications GROUP BY program_name');
    const programDistribution = [
      { name: 'Foundation', value: 0 },
      { name: 'Bachelor', value: 0 },
      { name: 'Masters', value: 0 }
    ];
    progDistRaw.forEach(row => {
      const p = row.program_name.toLowerCase();
      if (p.includes('found')) programDistribution[0].value += parseInt(row.count);
      else if (p.includes('master')) programDistribution[2].value += parseInt(row.count);
      else programDistribution[1].value += parseInt(row.count); // default to bachelor
    });

    // 5. Staff Performance
    const [staffPerformance] = await connection.query(`
      SELECT 
        u.full_name as name, 
        SUM(CASE WHEN a.status = 'VISA_COMPLETED' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN a.status <> 'VISA_COMPLETED' THEN 1 ELSE 0 END) as pending
      FROM users u 
      JOIN applications a ON u.id = a.assigned_staff_id 
      WHERE u.role = 'staff' 
      GROUP BY u.id, u.full_name
    `);

    // 6. Recent Activities
    const [recentActivities] = await connection.query(`
      SELECT 
        'Application Updated' as action, 
        COALESCE(u.full_name, a.applicant_name) as studentName,
        DATE_FORMAT(a.updated_at, '%Y-%m-%d %H:%i') as time 
      FROM applications a 
      LEFT JOIN users u ON a.student_id = u.id
      ORDER BY a.updated_at DESC 
      LIMIT 5
    `);

    res.json({
      kpis: {
        totalOrders: parseInt(totalOrders),
        successfulVisas: parseInt(successfulVisas),
        monthlyRevenue: monthlyRevenue,
        completedFiles: parseInt(completedFiles)
      },
      monthlyTrend,
      statusDistribution,
      programDistribution,
      staffPerformance,
      recentActivities
    });

  } catch (error) {
    console.error('Error in getAdminAnalytics:', error);
    res.status(500).json({ message: 'Server error retrieving analytics' });
  } finally {
    connection.release();
  }
};
