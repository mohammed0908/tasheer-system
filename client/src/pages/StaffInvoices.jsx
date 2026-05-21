import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  CheckCircle2,
  Clock3,
  DollarSign,
  Eye,
  FileText,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  WalletCards
} from 'lucide-react';
import CreateInvoiceModal from '../components/CreateInvoiceModal';
import ViewInvoiceModal from '../components/ViewInvoiceModal';

const departmentAliases = {
  Accountant: 'Finance',
  'Financial Manager': 'Finance',
  Counselor: 'Counselor',
  'Junior Counselor': 'Counselor',
  'Senior Counselor': 'Counselor'
};

const normalizeDepartment = (user) => (
  departmentAliases[user?.department] ||
  departmentAliases[user?.job_title] ||
  user?.department ||
  user?.job_title ||
  ''
);

const baseTabs = ['All Invoices', 'Paid', 'Pending Payment'];

const statusStyles = {
  Paid: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  Pending: 'bg-amber-50 text-amber-700 border-amber-100',
  'Pending Payment': 'bg-amber-50 text-amber-700 border-amber-100',
  'Waiting for Payment Verification': 'bg-blue-50 text-blue-700 border-blue-100',
  'Pending Verification': 'bg-blue-50 text-blue-700 border-blue-100',
  Rejected: 'bg-rose-50 text-rose-700 border-rose-100',
  Overdue: 'bg-rose-50 text-rose-700 border-rose-100'
};

const normalizeStatus = (status) => {
  if (status === 'Pending') return 'Pending Payment';
  if (status === 'Pending Verification') return 'Waiting for Payment Verification';
  return status || 'Pending Payment';
};

const formatAmount = (amount) => `USD ${parseFloat(amount || 0).toFixed(2)}`;

const formatDate = (dateString) => {
  if (!dateString) return 'Not recorded';
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

const StaffInvoices = () => {
  const [invoices, setInvoices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('All Invoices');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState('');
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const userDepartment = normalizeDepartment(user);
  const canCreateInvoice = user.role === 'admin' || userDepartment === 'Counselor';
  const canVerifyPayment = user.role === 'admin' || userDepartment === 'Finance';
  const tabs = canCreateInvoice ? [...baseTabs, 'Create Invoice'] : baseTabs;

  const fetchInvoices = useCallback(async ({ showLoading = true } = {}) => {
    try {
      if (showLoading) setIsLoading(true);
      setError('');
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/invoices', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setInvoices(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to fetch invoices:', err);
      setError('Failed to load invoices.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetchInvoices({ showLoading: false });
    }, 0);

    return () => window.clearTimeout(timer);
  }, [fetchInvoices]);

  const invoiceRows = useMemo(() => invoices.map(invoice => ({
    id: invoice.payment_id,
    clientName: invoice.client_name || 'Unknown client',
    description: invoice.description || 'Application Fee',
    university: invoice.university_name || 'Not assigned',
    amount: formatAmount(invoice.amount),
    rawAmount: Number(invoice.amount || 0),
    date: formatDate(invoice.due_date || invoice.payment_date || invoice.created_at),
    status: normalizeStatus(invoice.payment_status),
    rawStatus: invoice.payment_status,
    receiptUrl: invoice.receipt_url || invoice.receipt_path
  })), [invoices]);

  const displayedInvoices = invoiceRows.filter(invoice => {
    const matchesTab = activeTab === 'All Invoices' || invoice.status === activeTab;
    const matchesSearch = `${invoice.clientName} ${invoice.id}`.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'All' || invoice.status === statusFilter;
    return matchesTab && matchesSearch && matchesStatus;
  });

  const paidCount = invoiceRows.filter(invoice => invoice.status === 'Paid').length;
  const pendingCount = invoiceRows.filter(invoice => invoice.status === 'Pending Payment').length;
  const pendingVerificationCount = invoiceRows.filter(invoice => invoice.status === 'Waiting for Payment Verification').length;
  const totalAmount = invoiceRows.reduce((sum, invoice) => sum + invoice.rawAmount, 0);

  const financialCards = [
    { label: 'Total Requests', value: String(invoiceRows.length), icon: Receipt, accent: 'bg-slate-50 text-slate-600 border-slate-200' },
    { label: 'Paid', value: String(paidCount), icon: CheckCircle2, accent: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
    { label: 'Pending Payment', value: String(pendingCount), icon: Clock3, accent: 'bg-amber-50 text-amber-600 border-amber-100' },
    { label: 'Waiting Verification', value: String(pendingVerificationCount), icon: FileText, accent: 'bg-blue-50 text-blue-600 border-blue-100' },
    { label: 'Total Amount USD', value: `$${totalAmount.toFixed(2)}`, icon: DollarSign, accent: 'bg-indigo-50 text-indigo-600 border-indigo-100' }
  ];

  const handleTabClick = (tab) => {
    if (tab === 'Create Invoice') {
      setIsCreateModalOpen(true);
      return;
    }
    setActiveTab(tab);
  };

  const handleVerifyPayment = async (invoiceId) => {
    try {
      setActionLoading(`verify-${invoiceId}`);
      setError('');
      const token = localStorage.getItem('token');
      await axios.put(`/api/invoices/${invoiceId}/verify`, { status: 'Paid' }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      await fetchInvoices({ showLoading: false });
    } catch (err) {
      console.error('Failed to verify payment:', err);
      setError(err.response?.data?.message || 'Failed to verify payment.');
    } finally {
      setActionLoading('');
    }
  };

  return (
    <div className="space-y-6 bg-slate-50" dir="ltr">
      <div>
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-slate-400">Invoice Management</p>
        <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Financial Requests</h2>
      </div>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {financialCards.map(card => {
          const Icon = card.icon;
          return (
            <article key={card.label} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <div className={`mb-4 inline-flex rounded-xl border p-2.5 ${card.accent}`}>
                <Icon size={19} />
              </div>
              <p className="text-2xl font-black text-slate-950">{card.value}</p>
              <p className="mt-2 text-xs font-bold leading-5 text-slate-500">{card.label}</p>
            </article>
          );
        })}
      </section>

      <section className="rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 pt-4">
          <div className="flex flex-wrap gap-6">
            {tabs.map(tab => (
              <button
                key={tab}
                type="button"
                onClick={() => handleTabClick(tab)}
                className={`border-b-2 pb-4 text-sm font-black transition ${
                  activeTab === tab
                    ? 'border-indigo-600 text-indigo-600'
                    : tab === 'Create Invoice'
                      ? 'border-transparent text-emerald-600 hover:text-emerald-700'
                      : 'border-transparent text-slate-400 hover:text-slate-700'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4 p-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-1 flex-col gap-3 md:flex-row">
            <div className="relative w-full md:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by name or ID..."
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-indigo-300 focus:bg-white focus:ring-4 focus:ring-indigo-50"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-600 outline-none transition focus:border-indigo-300 focus:bg-white focus:ring-4 focus:ring-indigo-50"
            >
              <option value="All">Filter by Status</option>
              <option>Paid</option>
              <option>Pending Payment</option>
              <option>Waiting for Payment Verification</option>
              <option>Rejected</option>
              <option>Overdue</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => fetchInvoices()}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-black text-white shadow-sm shadow-indigo-100 transition hover:bg-indigo-700"
          >
            <RefreshCw size={16} />
            Refresh List
          </button>
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
          {error}
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="text-lg font-black text-slate-950">Invoice Records</h3>
            <p className="mt-1 text-sm font-medium text-slate-500">Review generated invoices and payment stages.</p>
          </div>
          <div className="hidden rounded-xl bg-indigo-50 p-2 text-indigo-500 sm:block">
            <Receipt size={20} />
          </div>
        </div>

        {isLoading ? (
          <div className="flex min-h-[320px] items-center justify-center text-sm font-bold text-slate-500">
            Loading invoices...
          </div>
        ) : displayedInvoices.length === 0 ? (
          <div className="flex min-h-[420px] flex-col items-center justify-center px-6 py-14 text-center">
            <div className="mb-5 flex h-24 w-24 items-center justify-center rounded-[2rem] bg-indigo-50 text-indigo-500">
              <WalletCards size={42} />
            </div>
            <h3 className="text-2xl font-black text-slate-950">No Invoices Found</h3>
            <p className="mt-2 max-w-md text-sm font-medium leading-6 text-slate-500">
              There are no invoices in the current stage.
            </p>
            <button
              type="button"
              onClick={() => fetchInvoices()}
              className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-600 shadow-sm transition hover:bg-slate-50"
            >
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-black uppercase tracking-[0.12em] text-slate-400">
                <tr>
                  <th className="px-5 py-4">Client Name</th>
                  <th className="px-5 py-4">Description/University</th>
                  <th className="px-5 py-4">Amount</th>
                  <th className="px-5 py-4">Date</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedInvoices.map(invoice => (
                  <tr key={invoice.id} className="transition hover:bg-slate-50/70">
                    <td className="px-5 py-4 font-black text-slate-950">{invoice.clientName}</td>
                    <td className="px-5 py-4">
                      <p className="font-bold text-slate-700">{invoice.description}</p>
                      <p className="mt-0.5 text-xs font-semibold text-slate-400">{invoice.university}</p>
                    </td>
                    <td className="px-5 py-4 font-black text-slate-900">{invoice.amount}</td>
                    <td className="px-5 py-4 font-semibold text-slate-500">{invoice.date}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${statusStyles[invoice.status] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                        {invoice.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <div className="flex justify-center gap-2">
                        {canVerifyPayment && invoice.status === 'Waiting for Payment Verification' && (
                          <button
                            type="button"
                            onClick={() => handleVerifyPayment(invoice.id)}
                            disabled={actionLoading === `verify-${invoice.id}`}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white transition hover:bg-emerald-700 disabled:opacity-60"
                          >
                            <CheckCircle2 size={15} />
                            {actionLoading === `verify-${invoice.id}` ? 'Verifying...' : 'Verify Payment'}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedInvoice(invoice);
                            setIsViewModalOpen(true);
                          }}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-indigo-100 hover:bg-indigo-50 hover:text-indigo-600"
                          aria-label={`View invoice ${invoice.id}`}
                        >
                          <Eye size={17} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <button
        type="button"
        onClick={() => setIsCreateModalOpen(true)}
        className="fixed bottom-6 right-6 inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 text-sm font-black text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700 lg:hidden"
      >
        <Plus size={17} />
        Create Invoice
      </button>

      <CreateInvoiceModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={fetchInvoices}
      />
      <ViewInvoiceModal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        invoiceData={selectedInvoice}
        onSuccess={fetchInvoices}
      />
    </div>
  );
};

export default StaffInvoices;
