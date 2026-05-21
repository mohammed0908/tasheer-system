import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ShieldCheck } from 'lucide-react';
import AuthShell from './AuthShell';

const VerifyEmailPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState(location.state?.email || '');
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    setIsLoading(true);

    try {
      const res = await axios.post('/api/auth/verify-registration', { email, otp: code });
      setMessage(res.data?.message || 'Email verified successfully.');
      window.setTimeout(() => navigate('/login'), 900);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to verify email');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthShell title="Verify Email" subtitle="Enter the 6-digit code sent to your inbox">
      {message && <div className="mb-4 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{message}</div>}
      {error && <div className="mb-4 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-bold text-slate-700">Email Address</label>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-50"
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-bold text-slate-700">Verification Code</label>
          <input
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
            className="h-14 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-center text-2xl font-black tracking-[0.4em] outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-50"
            required
          />
        </div>

        <button
          type="submit"
          disabled={isLoading || code.length !== 6}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 text-sm font-black text-white shadow-sm shadow-blue-100 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <ShieldCheck size={18} />
          {isLoading ? 'Verifying...' : 'Verify Email'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm font-semibold text-slate-500">
        Ready to login? <Link to="/login" className="font-black text-blue-600 hover:text-blue-700">Sign in</Link>
      </p>
    </AuthShell>
  );
};

export default VerifyEmailPage;
