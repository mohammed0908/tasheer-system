import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { 
  RefreshCw, TrendingUp, DollarSign, CheckCircle2, FileText, 
  Bell, Hourglass, Clock, Activity
} from 'lucide-react';
import { 
  PieChart, Pie, Cell, LineChart, Line, BarChart, Bar, 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from 'recharts';

const COLORS = {
  blue: '#3b82f6', green: '#10b981', yellow: '#f59e0b',
  purple: '#8b5cf6', teal: '#14b8a6', red: '#ef4444'
};

const AdminDashboard = () => {
  const [data, setData] = useState({
    kpis: { totalOrders: 0, successfulVisas: 0, monthlyRevenue: 0, completedFiles: 0 },
    monthlyTrend: [],
    statusDistribution: [],
    programDistribution: [],
    staffPerformance: [],
    recentActivities: []
  });
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState('');
  const [invoices, setInvoices] = useState([]);
  const [financeSummary, setFinanceSummary] = useState({ totalIncome: 0, totalExpenses: 0, netRevenue: 0 });

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/dashboard/analytics', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const [invoiceRes, financeRes] = await Promise.all([
        axios.get('/api/invoices', { headers: { Authorization: `Bearer ${token}` } }),
        axios.get('/api/finance/summary', { headers: { Authorization: `Bearer ${token}` } })
      ]);

      setData(res.data);
      setInvoices(Array.isArray(invoiceRes.data) ? invoiceRes.data : []);
      setFinanceSummary(financeRes.data || { totalIncome: 0, totalExpenses: 0, netRevenue: 0 });
      
      const now = new Date();
      setLastUpdated(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } catch (err) {
      console.error('Error fetching analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchInitialAnalytics = async () => {
      await loadAnalytics();
    };

    fetchInitialAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-8">
        <RefreshCw className="w-10 h-10 text-blue-500 animate-spin mb-4" />
        <h2 className="text-xl font-bold text-gray-700">Loading Analytics...</h2>
        <p className="text-gray-500 text-sm mt-2">Compiling massive amounts of data</p>
      </div>
    );
  }

  const { kpis, monthlyTrend, statusDistribution, programDistribution, staffPerformance, recentActivities } = data;

  const revenueDistribution = [
    { name: 'Income', value: Number(financeSummary.totalIncome || 0) },
    { name: 'Expenses', value: Number(financeSummary.totalExpenses || 0) },
    { name: 'Net Profit', value: Math.max(Number(financeSummary.netRevenue || 0), 0) }
  ];
  const paidInvoices = invoices.filter(invoice => invoice.payment_status === 'Paid' || invoice.payment_status === 'completed').length;
  const pendingInvoices = invoices.filter(invoice => invoice.payment_status !== 'Paid' && invoice.payment_status !== 'completed').length;
  const invoiceTotal = invoices.length || 1;
  const paidPercent = Math.round((paidInvoices / invoiceTotal) * 100);
  const pendingPercent = Math.round((pendingInvoices / invoiceTotal) * 100);

  return (
    <div className="bg-gray-50 min-h-screen p-6 font-sans text-gray-800">
      
      {/* Row 1: Header & KPIs */}
      <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Educational System Dashboard</h1>
          <p className="text-sm text-gray-500 font-medium">Last updated today at {lastUpdated}</p>
        </div>
        <button 
          onClick={loadAnalytics}
          className="bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-semibold shadow-sm hover:bg-gray-50 transition-colors flex items-center gap-2"
        >
          <RefreshCw size={16} /> Refresh Data
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[
          { title: 'Total Orders', value: kpis.totalOrders, icon: <FileText size={24} className="text-blue-500" />, trend: '+12%' },
          { title: 'Successful Visas', value: kpis.successfulVisas, icon: <CheckCircle2 size={24} className="text-green-500" />, trend: '+5%' },
          { title: 'Monthly Revenue', value: `$${Number(financeSummary.totalIncome || kpis.monthlyRevenue).toFixed(2)}`, icon: <DollarSign size={24} className="text-emerald-500" />, trend: 'Stable' },
          { title: 'Completed Files', value: kpis.completedFiles, icon: <Activity size={24} className="text-purple-500" />, trend: '+8%' }
        ].map((kpi, idx) => (
          <div key={idx} className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-500 mb-1">{kpi.title}</p>
              <div className="flex items-end gap-3">
                <h3 className="text-2xl font-bold text-gray-900">{kpi.value}</h3>
                <span className="text-xs font-bold text-green-600 flex items-center gap-0.5 mb-1">
                  <TrendingUp size={12} /> {kpi.trend}
                </span>
              </div>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              {kpi.icon}
            </div>
          </div>
        ))}
      </div>

      {/* Row 2: Primary Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Current Orders Status</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie 
                  data={statusDistribution} 
                  innerRadius={60} outerRadius={80} 
                  paddingAngle={5} dataKey="value"
                >
                  {statusDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={[COLORS.blue, COLORS.yellow, COLORS.green, COLORS.red][index % 4]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Monthly Students</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#6b7280'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#6b7280'}} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Line type="monotone" dataKey="applications" stroke={COLORS.blue} strokeWidth={3} dot={{r: 4, strokeWidth: 2}} activeDot={{r: 6}} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Row 3: Secondary Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Revenue Distribution</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie 
                  data={revenueDistribution} 
                  outerRadius={80} 
                  dataKey="value"
                  label
                >
                  {revenueDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={[COLORS.purple, COLORS.teal, COLORS.blue][index % 3]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Orders by Program</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={programDistribution} barSize={40}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#6b7280'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#6b7280'}} />
                <Tooltip cursor={{fill: '#f3f4f6'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Bar dataKey="value" fill={COLORS.teal} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Row 4: Operations & Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Alerts & Tasks */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Alerts and Tasks</h3>
            <div className="space-y-3">
              <div className="flex items-start gap-4 p-4 rounded-lg bg-red-50 border border-red-100">
                <Bell className="text-red-500 w-5 h-5 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-red-800">2 Orders Pending Processing</h4>
                  <p className="text-xs text-red-600 mt-1">Requires immediate counselor assignment to prevent SLA breach.</p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-4 rounded-lg bg-yellow-50 border border-yellow-100">
                <Hourglass className="text-yellow-600 w-5 h-5 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-yellow-800">58 Need Follow Up</h4>
                  <p className="text-xs text-yellow-700 mt-1">Students have not uploaded their required documents for 3+ days.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center">
            <div>
              <h3 className="text-lg font-bold text-gray-800">Invoice Status</h3>
              <p className="text-sm text-gray-500">Overview of active payments</p>
            </div>
            <div className="flex gap-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{paidPercent}%</p>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Paid</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-400">{pendingPercent}%</p>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Pending</p>
              </div>
            </div>
          </div>
        </div>

        {/* Activity & Performance */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Recent Activities</h3>
          <div className="space-y-4 mb-8">
            {recentActivities.map((act, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <div className="bg-blue-50 p-2 rounded-full">
                  <Clock className="w-4 h-4 text-blue-500" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-800">{act.action} <span className="font-normal text-gray-500">for {act.studentName}</span></p>
                  <p className="text-xs text-gray-400">{act.time}</p>
                </div>
              </div>
            ))}
            {recentActivities.length === 0 && <p className="text-sm text-gray-500">No recent activities found.</p>}
          </div>

          <h3 className="text-lg font-bold text-gray-800 mb-4">Counselor Performance</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                <tr>
                  <th className="px-4 py-3 rounded-l-lg">Counselor Name</th>
                  <th className="px-4 py-3">Completed</th>
                  <th className="px-4 py-3">Pending</th>
                  <th className="px-4 py-3 rounded-r-lg">Success Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {staffPerformance.map((staff, idx) => {
                  const total = staff.completed + staff.pending;
                  const rate = total > 0 ? Math.round((staff.completed / total) * 100) : 0;
                  return (
                    <tr key={idx}>
                      <td className="px-4 py-3 font-medium text-gray-800">{staff.name}</td>
                      <td className="px-4 py-3 text-green-600 font-semibold">{staff.completed}</td>
                      <td className="px-4 py-3 text-yellow-600 font-semibold">{staff.pending}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-full bg-gray-200 rounded-full h-1.5">
                            <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${rate}%` }}></div>
                          </div>
                          <span className="text-xs font-bold text-gray-600">{rate}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {staffPerformance.length === 0 && <tr><td colSpan="4" className="text-center py-4 text-gray-500">No performance data available</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
};

export default AdminDashboard;
