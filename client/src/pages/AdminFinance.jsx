import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { BarChart3, CheckCircle2, DollarSign, Download, Eye, Plus, Receipt, TrendingDown, TrendingUp, Users } from 'lucide-react';
import Skeleton from 'react-loading-skeleton';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import ViewInvoiceModal from '../components/ViewInvoiceModal';

const money = (value) => `$${Number(value || 0).toFixed(2)}`;

const departmentAliases = {
  Accountant: 'Finance',
  'Financial Manager': 'Finance'
};

const normalizeDepartment = (user) => (
  departmentAliases[user?.department] ||
  departmentAliases[user?.job_title] ||
  user?.department ||
  user?.job_title ||
  ''
);

const AdminFinance = () => {
  const [summary, setSummary] = useState({ totalIncome: 0, totalExpenses: 0, netRevenue: 0, invoices: [], expenses: [] });
  const [expense, setExpense] = useState({ title: '', amount: '', date: new Date().toISOString().slice(0, 10), category: 'General' });
  const [salaryMonth, setSalaryMonth] = useState(new Date().toISOString().slice(0, 7));
  const [salaryMessage, setSalaryMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [applications, setApplications] = useState([]);
  const [staffMembers, setStaffMembers] = useState([]);
  const [selectedSalaryStaffId, setSelectedSalaryStaffId] = useState('');
  const [salaryAmount, setSalaryAmount] = useState('');
  const [actionLoading, setActionLoading] = useState('');
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isFinanceUser = normalizeDepartment(user) === 'Finance';

  const authHeaders = useCallback(() => ({ Authorization: `Bearer ${localStorage.getItem('token')}` }), []);

  const fetchSummary = useCallback(async () => {
    try {
      setIsLoading(true);
      const [summaryRes, applicationsRes, staffRes] = await Promise.all([
        axios.get('/api/finance/summary', { headers: authHeaders() }),
        axios.get('/api/applications', { headers: authHeaders() }),
        axios.get('/api/finance/payroll-staff', { headers: authHeaders() })
      ]);
      setSummary(summaryRes.data);
      setApplications(Array.isArray(applicationsRes.data) ? applicationsRes.data : []);
      setStaffMembers(Array.isArray(staffRes.data) ? staffRes.data : []);
    } catch (error) {
      console.error('Failed to fetch finance summary:', error);
    } finally {
      setIsLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    const timer = window.setTimeout(fetchSummary, 0);
    return () => window.clearTimeout(timer);
  }, [fetchSummary]);

  const handleExpenseSubmit = async (event) => {
    event.preventDefault();
    try {
      await axios.post('/api/finance/expenses', expense, { headers: authHeaders() });
      setExpense({ title: '', amount: '', date: new Date().toISOString().slice(0, 10), category: 'General' });
      await fetchSummary();
    } catch (error) {
      console.error('Failed to create expense:', error);
    }
  };

  const handleRecordSalaryExpense = async () => {
    try {
      setActionLoading('record-salaries');
      setSalaryMessage('');
      if (!selectedSalaryStaffId) {
        setSalaryMessage('Please choose a staff member first.');
        return;
      }
      const amountToRecord = Number(salaryAmount);
      if (!Number.isFinite(amountToRecord) || amountToRecord <= 0) {
        setSalaryMessage('Enter a salary amount greater than $0.00 before recording this payment.');
        return;
      }
      const [year, month] = salaryMonth.split('-').map(Number);
      const res = await axios.post('/api/finance/record-salaries', {
        month,
        year,
        staff_id: Number(selectedSalaryStaffId),
        amount: amountToRecord
      }, { headers: authHeaders() });
      setSalaryMessage(`Recorded ${money(res.data.amount)} salary payment for ${res.data.staff_name || 'selected staff'} for ${salaryMonth}.`);
      await fetchSummary();
    } catch (error) {
      console.error('Failed to record salary expense:', error);
      setSalaryMessage(error.response?.data?.message || 'Failed to record salary expense.');
    } finally {
      setActionLoading('');
    }
  };

  const escapeCsv = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

  const handleExportFinance = () => {
    const incomeRows = summary.invoices.map(invoice => [
      invoice.payment_date || invoice.due_date || '',
      'Income',
      invoice.description || 'Invoice Payment',
      invoice.amount || 0,
      invoice.payment_status || ''
    ]);
    const expenseRows = summary.expenses.map(item => [
      item.date || '',
      'Expense',
      item.title || item.category || 'Expense',
      item.amount || 0,
      'Recorded'
    ]);
    const headers = ['Date', 'Type', 'Description/Title', 'Amount', 'Status'];
    const csv = [headers, ...incomeRows, ...expenseRows]
      .map(row => row.map(escapeCsv).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'finance_report.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleAdvanceApplication = async (applicationId, newStatus) => {
    try {
      setActionLoading(`${applicationId}-${newStatus}`);
      await axios.put(`/api/applications/${applicationId}/advance-state`, { new_status: newStatus }, {
        headers: authHeaders()
      });
      await fetchSummary();
    } catch (error) {
      console.error(`Failed to advance application to ${newStatus}:`, error);
    } finally {
      setActionLoading('');
    }
  };

  const financeApplications = applications.filter(app => app.status === 'WAITING_PAYMENT_VERIFICATION');
  const activePayroll = summary.current_active_payroll ?? summary.currentActivePayroll ?? summary.currentSalaryObligation ?? summary.totalSalaries;
  const selectedSalaryStaff = staffMembers.find(member => String(member.id) === String(selectedSalaryStaffId));
  const selectedStaffSalary = Number(salaryAmount || selectedSalaryStaff?.monthly_salary || 0);

  const kpis = [
    { label: 'Total Income', value: money(summary.totalIncome || summary.totalIncoming), icon: TrendingUp, accent: 'bg-emerald-50 text-emerald-600' },
    { label: 'Total Expenses', value: money(summary.totalExpenses), icon: TrendingDown, accent: 'bg-rose-50 text-rose-600' },
    { label: 'Active Payroll', value: money(activePayroll), icon: Users, accent: 'bg-indigo-50 text-indigo-600' },
    { label: 'Net Profit', value: money(summary.netProfit ?? summary.netRevenue), icon: DollarSign, accent: 'bg-blue-50 text-blue-600' }
  ];

  const monthlyFinance = Array.isArray(summary.monthly) ? summary.monthly : [];

  return (
    <div className="space-y-6 bg-slate-50" dir="ltr">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-slate-400">Admin Workspace</p>
          <h1 className="mt-2 text-3xl font-black text-slate-950">Finance Overview</h1>
        </div>
        <button
          type="button"
          onClick={handleExportFinance}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800"
        >
          <Download size={18} />
          Export Report
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {kpis.map(item => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-slate-400">{item.label}</p>
                  <p className="mt-2 text-3xl font-black text-slate-950">{item.value}</p>
                </div>
                <div className={`rounded-2xl p-3 ${item.accent}`}>
                  <Icon size={24} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-slate-400">Financial Charts</p>
            <h2 className="mt-1 text-xl font-black text-slate-950">Monthly Incoming vs Outgoing</h2>
          </div>
          <BarChart3 className="text-slate-300" size={26} />
        </div>
        <div className="h-80">
          {monthlyFinance.length === 0 ? (
            <div className="flex h-full items-center justify-center rounded-2xl bg-slate-50 text-sm font-bold text-slate-500">
              {isLoading ? <Skeleton height={260} width="100%" borderRadius={18} /> : 'No monthly finance data yet.'}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyFinance}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(value) => `$${Number(value || 0).toLocaleString()}`} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value) => money(value)} />
                <Legend />
                <Bar dataKey="incoming" name="Incoming" fill="#10b981" radius={[8, 8, 0, 0]} />
                <Bar dataKey="outgoing" name="Outgoing + Salaries" fill="#ef4444" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-slate-400">Finance Workflow</p>
            <h2 className="mt-1 text-xl font-black text-slate-950">Invoice & Payment Approval Queue</h2>
          </div>
          {!isFinanceUser && (
            <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-500">
              Finance department required for actions
            </span>
          )}
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="p-3">Student</th>
                <th className="p-3">Program</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr><td colSpan="4" className="p-6 text-center text-slate-500">Loading finance queue...</td></tr>
              ) : financeApplications.length === 0 ? (
                <tr><td colSpan="4" className="p-6 text-center text-slate-500">No invoice or payment approvals waiting.</td></tr>
              ) : financeApplications.map(app => {
                const hasReceipt = Boolean(app.receipt_path);
                return (
                  <tr key={app.id}>
                    <td className="p-3 font-black text-slate-800">{app.student_name}</td>
                    <td className="p-3 text-slate-600">{app.university_name} / {app.program_name}</td>
                    <td className="p-3">
                      <span className="rounded-full border border-amber-100 bg-amber-50 px-3 py-1 text-xs font-black text-amber-700">
                        {app.status}
                      </span>
                      {app.status === 'WAITING_PAYMENT_VERIFICATION' && (
                        <span className={`ml-2 rounded-full px-2 py-1 text-[11px] font-black ${hasReceipt ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                          {hasReceipt ? 'Receipt uploaded' : 'Waiting receipt'}
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      {app.status === 'WAITING_PAYMENT_VERIFICATION' && (
                        <button
                          type="button"
                          onClick={() => handleAdvanceApplication(app.id, 'PAYMENT_VERIFIED')}
                          disabled={!isFinanceUser || !hasReceipt || actionLoading === `${app.id}-PAYMENT_VERIFIED`}
                          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                          <CheckCircle2 size={15} /> Verify Payment
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-black text-slate-950">Incoming Payments</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr><th className="p-3">Client</th><th className="p-3">Description</th><th className="p-3">Status</th><th className="p-3">Amount</th><th className="p-3 text-center">Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? <tr><td colSpan="5" className="p-6 text-center text-slate-500">Loading...</td></tr> : summary.invoices.map(invoice => (
                  <tr key={invoice.payment_id}>
                    <td className="p-3 font-bold text-slate-800">{invoice.client_name || 'Unknown'}</td>
                    <td className="p-3 text-slate-600">{invoice.description}</td>
                    <td className="p-3 text-slate-600">{invoice.payment_status}</td>
                    <td className="p-3 font-black text-slate-900">{money(invoice.amount)}</td>
                    <td className="p-3 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedInvoice({ ...invoice, id: invoice.payment_id, status: invoice.payment_status });
                          setIsViewModalOpen(true);
                        }}
                        className="inline-flex items-center justify-center rounded-xl bg-slate-100 p-2 text-slate-600 transition hover:bg-slate-200 hover:text-slate-900"
                        title="View invoice details"
                      >
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black text-slate-950">Outgoing Payments</h2>
            <Receipt className="text-slate-300" />
          </div>
          <div className="mt-4 rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.14em] text-indigo-500">Staff Salary Outgoing</p>
                <h3 className="mt-1 text-lg font-black text-slate-950">Pay salary for a selected staff member</h3>
                <p className="mt-1 text-sm font-semibold text-indigo-700">
                  Staff Management monthly salary total: {money(activePayroll)}
                </p>
                <Link to="/admin/staff" className="mt-2 inline-flex text-sm font-black text-indigo-700 underline-offset-4 hover:underline">
                  Manage staff salaries
                </Link>
              </div>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.4fr_0.8fr_0.8fr_auto] lg:items-end">
                <label className="block">
                  <span className="mb-1 block text-xs font-black uppercase tracking-[0.12em] text-indigo-500">Choose Staff</span>
                  <select
                    value={selectedSalaryStaffId}
                    onChange={event => {
                      const staffId = event.target.value;
                      const member = staffMembers.find(item => String(item.id) === String(staffId));
                      setSelectedSalaryStaffId(staffId);
                      setSalaryAmount(member ? String(Number(member.monthly_salary || 0)) : '');
                    }}
                    className="h-11 w-full rounded-xl border border-indigo-100 bg-white px-3 text-sm font-bold text-slate-700 outline-none"
                  >
                    <option value="">Select staff member</option>
                    {staffMembers.map(member => (
                      <option key={member.id} value={member.id}>
                        {member.full_name} - {member.department || member.job_title || 'Staff'} - {money(member.monthly_salary)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-black uppercase tracking-[0.12em] text-indigo-500">Month</span>
                  <input
                    type="month"
                    value={salaryMonth}
                    onChange={event => setSalaryMonth(event.target.value)}
                    className="h-11 w-full rounded-xl border border-indigo-100 bg-white px-3 text-sm font-bold text-slate-700 outline-none"
                  />
                </label>
                <div>
                  <span className="mb-1 block text-xs font-black uppercase tracking-[0.12em] text-indigo-500">Salary</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={salaryAmount}
                    onChange={event => setSalaryAmount(event.target.value)}
                    placeholder="0.00"
                    className="h-11 w-full rounded-xl border border-indigo-100 bg-white px-3 text-sm font-black text-slate-900 outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleRecordSalaryExpense}
                  disabled={actionLoading === 'record-salaries' || !selectedSalaryStaffId || selectedStaffSalary <= 0}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-black text-white hover:bg-indigo-700 disabled:opacity-60"
                >
                  <Users size={16} />
                  {actionLoading === 'record-salaries' ? 'Recording...' : 'Record as Paid'}
                </button>
              </div>
            </div>
            {salaryMessage && (
              <p className="mt-3 rounded-xl bg-white px-3 py-2 text-sm font-bold text-indigo-700">
                {salaryMessage}
              </p>
            )}
          </div>
          <form onSubmit={handleExpenseSubmit} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
            <input value={expense.title} onChange={e => setExpense(prev => ({ ...prev, title: e.target.value }))} placeholder="Expense title" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold outline-none md:col-span-2" required />
            <input type="number" min="0" step="0.01" value={expense.amount} onChange={e => setExpense(prev => ({ ...prev, amount: e.target.value }))} placeholder="Amount" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold outline-none" required />
            <button className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-black text-white">
              <Plus size={16} /> Add Expense
            </button>
            <input type="date" value={expense.date} onChange={e => setExpense(prev => ({ ...prev, date: e.target.value }))} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold outline-none md:col-span-2" required />
            <input value={expense.category} onChange={e => setExpense(prev => ({ ...prev, category: e.target.value }))} placeholder="Category" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold outline-none md:col-span-2" />
          </form>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr><th className="p-3">Title</th><th className="p-3">Category</th><th className="p-3">Date</th><th className="p-3">Amount</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {summary.expenses.map(item => (
                  <tr key={item.id}>
                    <td className="p-3 font-bold text-slate-800">{item.title}</td>
                    <td className="p-3 text-slate-600">{item.category}</td>
                    <td className="p-3 text-slate-600">{item.date ? new Date(item.date).toLocaleDateString() : '-'}</td>
                    <td className="p-3 font-black text-rose-600">{money(item.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <ViewInvoiceModal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        invoiceData={selectedInvoice}
        onSuccess={fetchSummary}
      />
    </div>
  );
};

export default AdminFinance;
