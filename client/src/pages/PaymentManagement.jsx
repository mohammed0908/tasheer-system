import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { CheckCircle, CreditCard, Download, Eye, Plus, Search } from 'lucide-react';
import CreateInvoiceModal from '../components/CreateInvoiceModal';
import VerifyPaymentModal from '../components/VerifyPaymentModal';
import ViewInvoiceModal from '../components/ViewInvoiceModal';

const PaymentManagement = () => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
  const [selectedInvoiceForVerification, setSelectedInvoiceForVerification] = useState(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  const fetchInvoices = useCallback(async ({ showLoading = true } = {}) => {
    try {
      if (showLoading) setLoading(true);
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/invoices', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setInvoices(res.data);
      setError(null);
    } catch (err) {
      console.error('Error fetching invoices:', err);
      setError('Failed to load invoices. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetchInvoices({ showLoading: false });
    }, 0);

    return () => window.clearTimeout(timer);
  }, [fetchInvoices]);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'completed':
      case 'Paid':
        return <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border border-green-200">Paid</span>;
      case 'overdue':
      case 'Overdue':
        return <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border border-red-200">Overdue</span>;
      case 'Pending Verification':
        return <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border border-blue-200">Pending Verification</span>;
      case 'Rejected':
        return <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border border-red-200">Rejected</span>;
      case 'pending':
      case 'Pending':
      default:
        return <span className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border border-yellow-200">Pending</span>;
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Not recorded';
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  const formatAmount = (amount) => {
    return `USD ${parseFloat(amount || 0).toFixed(2)}`;
  };

  const escapeCsv = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

  const handleExport = () => {
    const headers = ['Payment ID', 'Client Name', 'Client Email', 'Description', 'University', 'Amount', 'Due Date', 'Payment Date', 'Status'];
    const rows = invoices.map(invoice => [
      invoice.payment_id,
      invoice.client_name,
      invoice.client_email,
      invoice.description,
      invoice.university_name,
      invoice.amount,
      invoice.due_date,
      invoice.payment_date,
      invoice.payment_status
    ]);
    const csv = [headers, ...rows].map(row => row.map(escapeCsv).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'payments_export.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const openVerifyModal = (invoice) => {
    setSelectedInvoiceForVerification(invoice);
    setIsVerifyModalOpen(true);
  };

  const closeVerifyModal = () => {
    setIsVerifyModalOpen(false);
    setSelectedInvoiceForVerification(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 tracking-tight">Payment Management</h1>
          <p className="text-gray-500 text-sm mt-1">Track and manage client application invoices and payments.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center space-x-2 bg-agency-blue hover:bg-agency-lightBlue text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-sm transition-colors"
        >
          <Plus size={16} />
          <span>New Invoice</span>
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-500 p-4 rounded-lg text-sm border border-red-200">
          {error}
        </div>
      )}

      <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center">
        <div className="relative w-full max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search invoices by client or ID..."
            className="bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-lg focus:ring-agency-blue block w-full pl-10 p-2.5 outline-none transition-all"
          />
        </div>
        <div className="flex space-x-3">
          <select className="bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-lg focus:ring-agency-blue block w-48 p-2.5 outline-none font-medium appearance-none">
            <option>Status: All</option>
            <option>Pending</option>
            <option>Paid</option>
            <option>Overdue</option>
            <option>Pending Verification</option>
            <option>Rejected</option>
          </select>
          <button onClick={handleExport} type="button" className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-sm transition-colors">
            <Download size={16} />
            <span>Export</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto p-4 min-h-[500px]">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-100 text-gray-600 uppercase text-xs font-semibold">
              <tr>
                <th className="px-5 py-4 rounded-l-lg">Client Name</th>
                <th className="px-5 py-4">Description</th>
                <th className="px-5 py-4">Amount</th>
                <th className="px-5 py-4">Due Date</th>
                <th className="px-5 py-4 text-center">Status</th>
                <th className="px-5 py-4 text-center rounded-r-lg">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 border-t border-gray-100">
              {loading ? (
                <tr>
                  <td colSpan="6" className="text-center py-8 text-gray-500">Loading invoices...</td>
                </tr>
              ) : invoices.length > 0 ? (
                invoices.map((invoice) => (
                  <tr key={invoice.payment_id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="px-5 py-4">
                      <span className="font-bold text-gray-900">
                        {invoice.client_name || <span className="text-gray-400 italic">Unknown</span>}
                      </span>
                      {invoice.client_email && <span className="block text-xs text-gray-400">{invoice.client_email}</span>}
                    </td>
                    <td className="px-5 py-4 text-gray-700">
                      <span className="font-semibold">{invoice.description}</span>
                      {invoice.university_name && <span className="block text-xs text-gray-400">{invoice.university_name}</span>}
                    </td>
                    <td className="px-5 py-4 font-bold text-gray-800">
                      {formatAmount(invoice.amount)}
                    </td>
                    <td className="px-5 py-4 text-gray-700 font-mono">
                      {formatDate(invoice.due_date)}
                    </td>
                    <td className="px-5 py-4 text-center">
                      {getStatusBadge(invoice.payment_status)}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <div className="flex justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedInvoice({ ...invoice, id: invoice.payment_id, status: invoice.payment_status });
                            setIsViewModalOpen(true);
                          }}
                          className="inline-flex items-center justify-center rounded-lg bg-slate-100 p-2 text-slate-600 hover:bg-slate-200"
                          title="View invoice details"
                        >
                          <Eye size={16} />
                        </button>
                        {invoice.payment_status === 'Pending Verification' && (
                        <button
                          type="button"
                          onClick={() => openVerifyModal(invoice)}
                          className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-green-700"
                          title="Verify payment receipt"
                        >
                          <CheckCircle size={15} />
                          Verify
                        </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="text-center py-12">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <CreditCard className="w-12 h-12 text-gray-300" />
                      <p className="text-gray-500 font-medium text-lg">No invoices found.</p>
                      <p className="text-gray-400 text-sm">Generated invoices will appear here.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <CreateInvoiceModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreated={fetchInvoices}
      />
      <VerifyPaymentModal
        invoiceData={selectedInvoiceForVerification}
        isOpen={isVerifyModalOpen}
        onClose={closeVerifyModal}
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

export default PaymentManagement;
