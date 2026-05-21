import { useEffect, useState } from 'react';
import axios from 'axios';
import { Download, ExternalLink, Loader2, X } from 'lucide-react';
import { generateInvoicePDF } from '../utils/invoicePdf';

const statusStyles = {
  Paid: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  Pending: 'bg-amber-50 text-amber-700 border-amber-100',
  'Waiting for Payment Verification': 'bg-blue-50 text-blue-700 border-blue-100',
  'Pending Verification': 'bg-blue-50 text-blue-700 border-blue-100',
  Rejected: 'bg-rose-50 text-rose-700 border-rose-100',
  Overdue: 'bg-rose-50 text-rose-700 border-rose-100'
};

const toReceiptUrl = (receiptPath) => {
  if (!receiptPath) return '';
  if (/^https?:\/\//i.test(receiptPath)) return receiptPath;
  return receiptPath.startsWith('/') ? receiptPath : `/${receiptPath}`;
};

const isImageReceipt = (url) => /\.(png|jpe?g|webp|gif)$/i.test(url.split('?')[0]);
const isPdfReceipt = (url) => /\.pdf$/i.test(url.split('?')[0]);
const normalizeStatus = (status) => status === 'Pending Verification' ? 'Waiting for Payment Verification' : status;
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

const formatAmount = (amount) => `USD ${parseFloat(amount || 0).toFixed(2)}`;

const formatDate = (dateString) => {
  if (!dateString) return 'Not recorded';
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

const formatDateTime = (dateString) => {
  if (!dateString) return 'Not recorded';
  return new Date(dateString).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const Detail = ({ label, value }) => (
  <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
    <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">{label}</p>
    <p className="mt-1 text-sm font-bold text-slate-800">{value || 'Not provided'}</p>
  </div>
);

const ViewInvoiceModal = ({ invoiceData, isOpen, onClose, onSuccess }) => {
  const [invoice, setInvoice] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen || !invoiceData?.id) return;

    const fetchInvoice = async () => {
      try {
        setIsLoading(true);
        setError('');
        const token = localStorage.getItem('token');
        const res = await axios.get(`/api/invoices/${invoiceData.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setInvoice(res.data);
      } catch (err) {
        console.error('Failed to fetch invoice details:', err);
        setError(err.response?.data?.message || 'Failed to load invoice details.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchInvoice();
  }, [invoiceData, isOpen]);

  if (!isOpen) return null;

  const rawStatus = invoice?.payment_status || invoiceData?.rawStatus || invoiceData?.status || 'Pending';
  const status = normalizeStatus(rawStatus);
  const receiptUrl = toReceiptUrl(invoice?.receipt_url || invoice?.receipt_path || invoiceData?.receipt_url || invoiceData?.receipt_path);
  const verifiedAt = invoice?.verified_at || invoiceData?.verified_at;
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const canVerifyPayment = normalizeDepartment(currentUser) === 'Finance';

  const handleVerify = async (nextStatus) => {
    try {
      setActionLoading(nextStatus);
      setError('');
      const token = localStorage.getItem('token');
      await axios.put(`/api/invoices/${invoiceData.id}/verify`, { status: nextStatus }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      await onSuccess?.();
      onClose();
    } catch (err) {
      console.error('Failed to verify receipt:', err);
      setError(err.response?.data?.message || 'Failed to update payment status.');
    } finally {
      setActionLoading('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-6" dir="ltr">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-slate-950">Invoice Details</h2>
            <p className="mt-1 text-sm font-medium text-slate-500">Review invoice, client, and receipt information.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close invoice details"
          >
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="mb-5 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="flex min-h-[340px] items-center justify-center text-sm font-bold text-slate-500">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading invoice details...
          </div>
        ) : (
          <div className="space-y-6">
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-black uppercase tracking-[0.16em] text-slate-400">Invoice Summary</h3>
                <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${statusStyles[status] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                  {status}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Detail label="Invoice ID" value={invoice?.payment_id || invoiceData?.id} />
                <Detail label="Amount" value={formatAmount(invoice?.amount)} />
                <Detail label="Description" value={invoice?.description} />
                <Detail label="University" value={invoice?.university_name} />
                <Detail label="Date" value={formatDate(invoice?.due_date || invoice?.payment_date || invoice?.created_at)} />
              </div>
            </section>

            {status === 'Paid' && (
              <section>
                <h3 className="mb-3 text-sm font-black uppercase tracking-[0.16em] text-slate-400">Verification Details</h3>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-500">Status</p>
                    <span className="mt-2 inline-flex rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-black text-emerald-700">
                      Paid
                    </span>
                  </div>
                  <Detail label="Verified On" value={formatDateTime(verifiedAt)} />
                </div>
              </section>
            )}

            <section>
              <h3 className="mb-3 text-sm font-black uppercase tracking-[0.16em] text-slate-400">Client Details</h3>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <Detail label="Name" value={invoice?.client_name} />
                <Detail label="Email" value={invoice?.client_email} />
                <Detail label="Phone" value={invoice?.client_phone} />
              </div>
            </section>

            <section>
              <h3 className="mb-3 text-sm font-black uppercase tracking-[0.16em] text-slate-400">Proof of Payment</h3>
              {receiptUrl && isImageReceipt(receiptUrl) ? (
                <div className="flex justify-center rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <img src={receiptUrl} alt="Payment Receipt" className="mt-2 max-w-full rounded border border-slate-200 object-contain" />
                </div>
              ) : receiptUrl && isPdfReceipt(receiptUrl) ? (
                <a
                  href={receiptUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-black text-white transition hover:bg-indigo-700"
                >
                  <ExternalLink size={16} />
                  View Receipt
                </a>
              ) : receiptUrl ? (
                <a
                  href={receiptUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-black text-white transition hover:bg-indigo-700"
                >
                  <ExternalLink size={16} />
                  Open Receipt
                </a>
              ) : (
                <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-5 text-sm font-bold text-slate-500">
                  No receipt uploaded.
                </div>
              )}
            </section>
          </div>
        )}

        <div className="mt-6 flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => generateInvoicePDF(invoice || invoiceData)}
            disabled={isLoading || Boolean(actionLoading)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-black text-white transition hover:bg-indigo-700 disabled:opacity-60"
          >
            <Download size={16} />
            Download Invoice (PDF)
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={Boolean(actionLoading)}
            className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm font-black text-slate-600 transition hover:bg-slate-200 disabled:opacity-60"
          >
            Close
          </button>
          {canVerifyPayment && status === 'Waiting for Payment Verification' && !isLoading && (
            <>
              <button
                type="button"
                onClick={() => handleVerify('Rejected')}
                disabled={Boolean(actionLoading)}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-black text-white transition hover:bg-rose-700 disabled:opacity-60"
              >
                {actionLoading === 'Rejected' && <Loader2 size={16} className="animate-spin" />}
                Reject Receipt
              </button>
              <button
                type="button"
                onClick={() => handleVerify('Paid')}
                disabled={Boolean(actionLoading)}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white transition hover:bg-emerald-700 disabled:opacity-60"
              >
                {actionLoading === 'Paid' && <Loader2 size={16} className="animate-spin" />}
                Verify Payment
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ViewInvoiceModal;
