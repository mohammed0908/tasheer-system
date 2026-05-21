import React, { useState } from 'react';
import axios from 'axios';
import { ExternalLink, Loader2, X } from 'lucide-react';

const API_ORIGIN = axios.defaults.baseURL || '';

const toReceiptUrl = (receiptPath) => {
  if (!receiptPath) return '';
  if (/^https?:\/\//i.test(receiptPath)) return receiptPath;
  return `${API_ORIGIN}${receiptPath.startsWith('/') ? receiptPath : `/${receiptPath}`}`;
};

const isImageReceipt = (url) => /\.(png|jpe?g|webp|gif)$/i.test(url.split('?')[0]);
const isPdfReceipt = (url) => /\.pdf$/i.test(url.split('?')[0]);
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

const VerifyPaymentModal = ({ invoiceData, isOpen, onClose, onSuccess }) => {
  const [loadingAction, setLoadingAction] = useState('');
  const [error, setError] = useState('');

  if (!isOpen || !invoiceData) return null;

  const receiptUrl = toReceiptUrl(invoiceData.receipt_url || invoiceData.receipt_path);
  const amount = `USD ${parseFloat(invoiceData.amount || 0).toFixed(2)}`;
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const canVerifyPayment = normalizeDepartment(currentUser) === 'Finance';

  const handleVerify = async (status) => {
    try {
      setLoadingAction(status);
      setError('');
      const token = localStorage.getItem('token');
      await axios.put(
        `/api/invoices/${invoiceData.payment_id}/verify`,
        { status },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await onSuccess?.();
      onClose();
    } catch (err) {
      console.error('Error verifying payment:', err);
      setError(err.response?.data?.message || 'Failed to update payment status.');
    } finally {
      setLoadingAction('');
    }
  };

  const anyLoading = Boolean(loadingAction);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl border border-gray-200">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Verify Payment Receipt</h2>
            <p className="text-sm text-gray-500">Review the uploaded proof before updating invoice status.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={anyLoading}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-5 px-6 py-5">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="grid gap-3 rounded-lg border border-gray-100 bg-gray-50 p-4 sm:grid-cols-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Client</p>
              <p className="mt-1 font-bold text-gray-900">{invoiceData.client_name || 'Unknown client'}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Description</p>
              <p className="mt-1 font-bold text-gray-900">{invoiceData.description}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Amount</p>
              <p className="mt-1 font-bold text-gray-900">{amount}</p>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="mb-3 text-sm font-semibold text-gray-700">Receipt</p>
            {receiptUrl && isImageReceipt(receiptUrl) ? (
              <div className="flex items-center justify-center rounded-lg bg-gray-50 p-3">
                <img
                  src={receiptUrl}
                  alt="Payment receipt"
                  className="max-h-64 w-full object-contain"
                />
              </div>
            ) : receiptUrl && isPdfReceipt(receiptUrl) ? (
              <a
                href={receiptUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-agency-blue px-4 py-2 text-sm font-semibold text-white hover:bg-agency-lightBlue"
              >
                <ExternalLink size={16} />
                View/Download Receipt
              </a>
            ) : receiptUrl ? (
              <a
                href={receiptUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-agency-blue px-4 py-2 text-sm font-semibold text-white hover:bg-agency-lightBlue"
              >
                <ExternalLink size={16} />
                Open Receipt
              </a>
            ) : (
              <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
                No receipt file is attached to this invoice.
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-gray-100 px-6 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={anyLoading}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            Cancel
          </button>
          {canVerifyPayment && (
            <>
              <button
                type="button"
                onClick={() => handleVerify('Rejected')}
                disabled={anyLoading}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {loadingAction === 'Rejected' && <Loader2 size={16} className="animate-spin" />}
                Reject Receipt
              </button>
              <button
                type="button"
                onClick={() => handleVerify('Paid')}
                disabled={anyLoading}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
              >
                {loadingAction === 'Paid' && <Loader2 size={16} className="animate-spin" />}
                Approve Payment
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default VerifyPaymentModal;
