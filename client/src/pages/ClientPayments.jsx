import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { ArrowLeft, CreditCard, Download, FileUp, Landmark, Loader2, UploadCloud } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { generateInvoicePDF } from '../utils/invoicePdf';
import PaymentGatewayModal from '../components/PaymentGatewayModal';

const ClientPayments = () => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadingInvoiceId, setUploadingInvoiceId] = useState(null);
  const [selectedCashInvoiceId, setSelectedCashInvoiceId] = useState(null);
  const [selectedOnlineInvoice, setSelectedOnlineInvoice] = useState(null);
  const [message, setMessage] = useState('');
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  const fetchInvoices = useCallback(async ({ showLoading = true } = {}) => {
    try {
      if (showLoading) setLoading(true);
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/invoices/my', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setInvoices(res.data);
    } catch (err) {
      console.error('Error fetching invoices:', err);
      setMessage(err.response?.data?.message || 'Failed to load invoices.');
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

  const formatAmount = (amount) => `USD ${parseFloat(amount || 0).toFixed(2)}`;

  const formatDate = (dateString) => {
    if (!dateString) return 'Not recorded';
    return new Date(dateString).toLocaleDateString();
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Paid':
        return <span className="rounded-full border border-green-200 bg-green-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-green-700">Paid</span>;
      case 'Overdue':
        return <span className="rounded-full border border-red-200 bg-red-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-red-700">Overdue</span>;
      case 'Pending Verification':
        return <span className="rounded-full border border-blue-200 bg-blue-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-blue-700">Waiting for Payment Verification</span>;
      case 'Rejected':
        return <span className="rounded-full border border-red-200 bg-red-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-red-700">Rejected - Try Again</span>;
      default:
        return <span className="rounded-full border border-yellow-200 bg-yellow-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-yellow-700">Pending</span>;
    }
  };

  const handleReceiptUpload = async (event) => {
    const file = event.target.files[0];
    if (!file || !selectedCashInvoiceId) return;

    try {
      setUploadingInvoiceId(selectedCashInvoiceId);
      setMessage('');
      const formData = new FormData();
      formData.append('receipt', file);

      const token = localStorage.getItem('token');
      await axios.post(`/api/invoices/${selectedCashInvoiceId}/receipt`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setMessage('Receipt uploaded. Your payment is waiting for payment verification.');
      setSelectedCashInvoiceId(null);
      await fetchInvoices();
    } catch (err) {
      console.error('Error uploading receipt:', err);
      setMessage(err.response?.data?.message || 'Failed to upload receipt.');
    } finally {
      setUploadingInvoiceId(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-agency-grey pb-10">
      <nav className="bg-white text-gray-800 p-4 shadow-sm border-b border-gray-200">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center">
            <img src="/logo.png" alt="Tasheer Agency Logo" className="h-20 w-auto object-contain mr-4" />
            <span className="font-bold text-2xl uppercase tracking-widest text-agency-blue hidden sm:block">Tasheer | Payments</span>
          </div>
          <button
            onClick={() => navigate('/client')}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            <ArrowLeft size={16} />
            Back to Portal
          </button>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto p-6 md:p-8 mt-6">
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900">My Invoices</h1>
          <p className="mt-1 text-sm text-gray-500">Review pending invoices and choose your payment method.</p>
        </div>

        {message && (
          <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            {message}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={handleReceiptUpload}
        />

        {loading ? (
          <div className="flex items-center justify-center rounded-xl border border-gray-200 bg-white p-12 text-gray-500">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading invoices...
          </div>
        ) : invoices.length > 0 ? (
          <div className="space-y-4">
            {invoices.map(invoice => {
              const isActionable = ['Pending', 'Overdue', 'Rejected'].includes(invoice.payment_status);
              const isCashOpen = selectedCashInvoiceId === invoice.payment_id;

              return (
                <div key={invoice.payment_id} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="mb-2 flex items-center gap-3">
                        <h2 className="text-lg font-bold text-gray-900">{invoice.description}</h2>
                        {getStatusBadge(invoice.payment_status)}
                      </div>
                      <p className="text-sm text-gray-500">
                        Due {formatDate(invoice.due_date)}
                        {invoice.university_name ? ` - ${invoice.university_name}` : ''}
                      </p>
                      {invoice.payment_status === 'Rejected' && (
                        <p className="mt-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                          Your first transaction was rejected. Please try again.
                        </p>
                      )}
                    </div>
                    <div className="text-left md:text-right">
                      <p className="text-2xl font-bold text-agency-blue">{formatAmount(invoice.amount)}</p>
                      <p className="text-xs text-gray-400">Invoice #{invoice.payment_id}</p>
                    </div>
                  </div>

                  {isActionable && (
                    <div className="mt-5 grid gap-3 sm:grid-cols-3">
                      <button
                        onClick={() => setSelectedOnlineInvoice(invoice)}
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-agency-blue px-4 py-3 text-sm font-semibold text-white hover:bg-agency-lightBlue"
                      >
                        <CreditCard size={18} />
                        Pay Online
                      </button>
                      <button
                        onClick={() => setSelectedCashInvoiceId(isCashOpen ? null : invoice.payment_id)}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                      >
                        <Landmark size={18} />
                        Pay via Cash/Bank Transfer
                      </button>
                      <button
                        onClick={() => generateInvoicePDF({ ...invoice, id: invoice.payment_id })}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700 hover:bg-blue-100"
                      >
                        <Download size={18} />
                        Download Invoice
                      </button>
                    </div>
                  )}

                  {!isActionable && (
                    <button
                      onClick={() => generateInvoicePDF({ ...invoice, id: invoice.payment_id })}
                      className="mt-5 inline-flex items-center justify-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700 hover:bg-blue-100"
                    >
                      <Download size={18} />
                      Download Invoice (PDF)
                    </button>
                  )}

                  {isCashOpen && (
                    <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 p-4">
                      <div className="mb-3 flex items-start gap-3">
                        <FileUp className="mt-0.5 h-5 w-5 text-agency-blue" />
                        <div>
                          <p className="font-semibold text-gray-800">Upload Payment Receipt</p>
                          <p className="text-sm text-gray-500">PNG, JPG, or WEBP receipts are accepted.</p>
                        </div>
                      </div>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingInvoiceId === invoice.payment_id}
                        className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-agency-blue border border-blue-100 hover:bg-blue-50 disabled:opacity-60"
                      >
                        {uploadingInvoiceId === invoice.payment_id ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
                        {uploadingInvoiceId === invoice.payment_id ? 'Uploading...' : 'Choose Receipt'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-gray-200 bg-white p-12 text-center shadow-sm">
            <CreditCard className="mx-auto h-12 w-12 text-gray-300" />
            <h2 className="mt-3 text-lg font-bold text-gray-700">No invoices yet</h2>
            <p className="mt-1 text-sm text-gray-400">New invoices from your advisor will appear here.</p>
          </div>
        )}
      </main>
      <PaymentGatewayModal
        invoice={selectedOnlineInvoice}
        isOpen={Boolean(selectedOnlineInvoice)}
        onClose={() => setSelectedOnlineInvoice(null)}
        onSuccess={async () => {
          setMessage('Online payment successful. Your application is now waiting for visa processing.');
          await fetchInvoices();
        }}
        onReturnToDashboard={() => navigate('/client')}
      />
    </div>
  );
};

export default ClientPayments;
