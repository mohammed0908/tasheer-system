import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { KeyRound } from 'lucide-react';
import AuthShell from './AuthShell';
import { getPasswordScore, passwordRules } from './passwordRules';

const ResetPasswordPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: location.state?.email || '',
    reset_token: '',
    newPassword: ''
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const passwordScore = getPasswordScore(formData.newPassword);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'reset_token' ? value.replace(/\D/g, '').slice(0, 6) : value
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage('');
    setError('');
    setIsLoading(true);

    try {
      const res = await axios.post('/api/auth/reset-password', formData);
      setMessage(res.data?.message || 'Password reset successfully.');
      window.setTimeout(() => navigate('/login'), 900);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reset password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthShell title="Reset Password" subtitle="Enter your code and choose a strong new password">
      {message && <div className="mb-4 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{message}</div>}
      {error && <div className="mb-4 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-bold text-slate-700">Email Address</label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-50"
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-bold text-slate-700">Reset Code</label>
          <input
            name="reset_token"
            value={formData.reset_token}
            onChange={handleChange}
            className="h-14 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-center text-2xl font-black tracking-[0.4em] outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-50"
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-bold text-slate-700">New Password</label>
          <input
            type="password"
            name="newPassword"
            value={formData.newPassword}
            onChange={handleChange}
            className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-50"
            required
          />
        </div>

        <div className="h-2 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${(passwordScore / passwordRules.length) * 100}%` }} />
        </div>

        <button
          type="submit"
          disabled={isLoading || formData.reset_token.length !== 6 || passwordScore < passwordRules.length}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 text-sm font-black text-white shadow-sm shadow-blue-100 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <KeyRound size={18} />
          {isLoading ? 'Resetting...' : 'Reset Password'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm font-semibold text-slate-500">
        Back to <Link to="/login" className="font-black text-blue-600 hover:text-blue-700">sign in</Link>
      </p>
    </AuthShell>
  );
};

export default ResetPasswordPage;
