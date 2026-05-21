import { useMemo, useState } from 'react';
import axios from 'axios';
import { CheckCircle2, CreditCard, Loader2, Lock, ReceiptText, X } from 'lucide-react';
import Confetti from 'react-confetti';
import toast from 'react-hot-toast';
import { generateInvoicePDF } from '../utils/invoicePdf';

const initialForm = {
  cardholder_name: '',
  card_number: '',
  expiry: '',
  cvc: ''
};

const money = (amount) => `USD ${Number(amount || 0).toFixed(2)}`;

const delay = (ms) => new Promise(resolve => window.setTimeout(resolve, ms));

const formatCardNumber = (value) => (
  value
    .replace(/\D/g, '')
    .slice(0, 16)
    .replace(/(.{4})/g, '$1 ')
    .trim()
);

const formatExpiry = (value) => {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
};

const PaymentGatewayModal = ({ invoice, isOpen, onClose, onSuccess, onReturnToDashboard }) => {
  const [formData, setFormData] = useState(initialForm);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [transaction, setTransaction] = useState(null);
  const [showConfetti, setShowConfetti] = useState(false);

  const paidInvoice = useMemo(() => ({
    ...invoice,
    id: invoice?.payment_id,
    status: 'PAID',
    payment_status: 'PAID',
    payment_date: transaction?.paid_at || new Date().toISOString()
  }), [invoice, transaction]);

  const resetPaymentState = () => {
    setFormData(initialForm);
    setIsProcessing(false);
    setError('');
    setTransaction(null);
  };

  if (!isOpen || !invoice) return null;

  const handleClose = () => {
    if (isProcessing) return;
    resetPaymentState();
    onClose();
  };

  const handleChange = (field, value) => {
    const nextValue = field === 'card_number'
      ? formatCardNumber(value)
      : field === 'expiry'
        ? formatExpiry(value)
        : field === 'cvc'
          ? value.replace(/\D/g, '').slice(0, 4)
          : value;
    setFormData(prev => ({ ...prev, [field]: nextValue }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    const cardDigits = formData.card_number.replace(/\s/g, '');
    if (!formData.cardholder_name.trim() || cardDigits.length < 12 || !formData.expiry || !formData.cvc) {
      setError('Please complete all payment fields before continuing.');
      return;
    }

    try {
      setIsProcessing(true);
      await delay(2000);
      const token = localStorage.getItem('token');
      const res = await axios.post('/api/payments/simulate', {
        invoice_id: invoice.payment_id,
        amount: invoice.amount,
        card_last_four: cardDigits.slice(-4)
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTransaction(res.data);
      setShowConfetti(true);
      window.setTimeout(() => setShowConfetti(false), 5000);
      toast.success('Payment completed successfully.');
      await onSuccess?.(res.data);
    } catch (err) {
      console.error('Simulated payment failed:', err);
      const message = err.response?.data?.message || 'Payment could not be processed. Please try again.';
      setError(message);
      toast.error(message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReturn = () => {
    resetPaymentState();
    onReturnToDashboard?.();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" dir="ltr">
      {showConfetti && <Confetti width={window.innerWidth} height={window.innerHeight} recycle={false} numberOfPieces={260} />}
      <div className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">Tasheer Agency</p>
            <h2 className="mt-1 text-2xl font-black text-slate-950">Secure Checkout</h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isProcessing}
            className="rounded-2xl p-2 text-slate-400 transition hover:bg-slate-100 disabled:opacity-50"
            aria-label="Close payment gateway"
          >
            <X size={20} />
          </button>
        </div>

        {transaction ? (
          <div className="p-8 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle2 size={44} />
            </div>
            <h3 className="mt-5 text-2xl font-black text-slate-950">Payment Successful</h3>
            <p className="mt-2 text-sm font-semibold text-slate-500">
              Your payment was processed and your application is now waiting for visa processing.
            </p>
            <div className="mx-auto mt-6 max-w-md rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-left">
              <div className="flex items-center justify-between text-sm">
                <span className="font-bold text-emerald-700">Transaction ID</span>
                <span className="font-black text-emerald-950">{transaction.transaction_id}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="font-bold text-emerald-700">Amount Paid</span>
                <span className="font-black text-emerald-950">{money(transaction.amount)}</span>
              </div>
            </div>
            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => generateInvoicePDF(paidInvoice)}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-blue-100 bg-blue-50 px-5 py-3 text-sm font-black text-blue-700 hover:bg-blue-100"
              >
                <ReceiptText size={18} />
                Download Receipt
              </button>
              <button
                type="button"
                onClick={handleReturn}
                className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white hover:bg-blue-700"
              >
                Return to Dashboard
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6">
            <div className="rounded-3xl bg-slate-950 p-5 text-white shadow-lg">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-200">Invoice</p>
                  <h3 className="mt-2 text-xl font-black">#{invoice.payment_id}</h3>
                  <p className="mt-1 text-sm font-semibold text-slate-300">{invoice.description || 'Application Invoice'}</p>
                </div>
                <CreditCard className="text-blue-200" size={34} />
              </div>
              <div className="mt-6 flex items-end justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Total Amount Due</p>
                  <p className="mt-1 text-3xl font-black">{money(invoice.amount)}</p>
                </div>
                <div className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-xs font-bold text-slate-200">
                  <Lock size={14} />
                  Simulated secure payment
                </div>
              </div>
            </div>

            {error && (
              <div className="mt-5 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
                {error}
              </div>
            )}

            <div className="mt-6 grid gap-4">
              <label className="block">
                <span className="text-sm font-black text-slate-700">Cardholder Name</span>
                <input
                  value={formData.cardholder_name}
                  onChange={event => handleChange('cardholder_name', event.target.value)}
                  disabled={isProcessing}
                  placeholder="Name on card"
                  className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-50 disabled:opacity-60"
                  required
                />
              </label>

              <label className="block">
                <span className="text-sm font-black text-slate-700">Card Number</span>
                <input
                  value={formData.card_number}
                  onChange={event => handleChange('card_number', event.target.value)}
                  disabled={isProcessing}
                  inputMode="numeric"
                  placeholder="4242 4242 4242 4242"
                  className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold tracking-[0.08em] outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-50 disabled:opacity-60"
                  required
                />
              </label>

              <div className="grid grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-sm font-black text-slate-700">Expiry Date</span>
                  <input
                    value={formData.expiry}
                    onChange={event => handleChange('expiry', event.target.value)}
                    disabled={isProcessing}
                    inputMode="numeric"
                    placeholder="MM/YY"
                    className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-50 disabled:opacity-60"
                    required
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-black text-slate-700">CVC</span>
                  <input
                    value={formData.cvc}
                    onChange={event => handleChange('cvc', event.target.value)}
                    disabled={isProcessing}
                    inputMode="numeric"
                    placeholder="123"
                    className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-50 disabled:opacity-60"
                    required
                  />
                </label>
              </div>
            </div>

            <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={handleClose}
                disabled={isProcessing}
                className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-black text-slate-600 hover:bg-slate-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isProcessing}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-6 py-3 text-sm font-black text-white shadow-sm shadow-blue-100 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isProcessing && <Loader2 size={18} className="animate-spin" />}
                {isProcessing ? 'Processing Payment...' : `Pay ${money(invoice.amount)}`}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default PaymentGatewayModal;
