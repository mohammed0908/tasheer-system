import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { CheckCircle, ShieldCheck, UserPlus, X } from 'lucide-react';
import AuthShell from './AuthShell';
import { getPasswordScore, passwordRules } from './passwordRules';

const SignupPage = () => {
  const [formData, setFormData] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [otp, setOtp] = useState('');
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [error, setError] = useState('');
  const [otpError, setOtpError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const navigate = useNavigate();
  const passwordScore = getPasswordScore(formData.password);
  const passwordsMatch = formData.password === formData.confirmPassword;
  const showPasswordMismatch = formData.confirmPassword.length > 0 && !passwordsMatch;

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!passwordsMatch) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);

    try {
      const registrationData = {
        name: formData.name,
        email: formData.email,
        password: formData.password
      };
      const res = await axios.post('/api/auth/register', registrationData);
      toast.success(res.data?.message || 'OTP sent to your email.');
      setShowOtpModal(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create account');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (event) => {
    event.preventDefault();
    setOtpError('');
    setIsVerifying(true);

    try {
      const res = await axios.post('/api/auth/verify-registration', {
        email: formData.email,
        otp
      });
      toast.success(res.data?.message || 'Email verified successfully.');
      setShowOtpModal(false);
      navigate('/login', { state: { email: formData.email } });
    } catch (err) {
      setOtpError(err.response?.data?.message || 'Invalid or expired OTP');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <AuthShell title="Create Student Account" subtitle="Signup is restricted to client/student accounts">
      {error && (
        <div className="mb-4 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-bold text-slate-700">Full Name</label>
          <input
            name="name"
            value={formData.name}
            onChange={handleChange}
            className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-50"
            required
          />
        </div>

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
          <label className="mb-1 block text-sm font-bold text-slate-700">Password</label>
          <input
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-50"
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-bold text-slate-700">Confirm Password</label>
          <input
            type="password"
            name="confirmPassword"
            value={formData.confirmPassword}
            onChange={handleChange}
            className={`h-12 w-full rounded-xl border bg-slate-50 px-4 text-sm font-semibold outline-none transition focus:bg-white focus:ring-4 ${
              showPasswordMismatch
                ? 'border-rose-200 focus:border-rose-300 focus:ring-rose-50'
                : 'border-slate-200 focus:border-blue-300 focus:ring-blue-50'
            }`}
            required
          />
          {showPasswordMismatch && (
            <p className="mt-2 text-xs font-bold text-rose-600">Passwords do not match.</p>
          )}
        </div>

        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
          <div className="h-2 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-blue-600 transition-all"
              style={{ width: `${(passwordScore / passwordRules.length) * 100}%` }}
            />
          </div>
          <div className="mt-3 space-y-2">
            {passwordRules.map(rule => {
              const isMet = rule.test(formData.password);
              return (
                <div key={rule.label} className={`flex items-center gap-2 text-xs font-bold ${isMet ? 'text-emerald-600' : 'text-slate-400'}`}>
                  <CheckCircle size={14} />
                  {rule.label}
                </div>
              );
            })}
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading || passwordScore < passwordRules.length || !passwordsMatch}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 text-sm font-black text-white shadow-sm shadow-blue-100 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <UserPlus size={18} />
          {isLoading ? 'Creating Account...' : 'Create Account'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm font-semibold text-slate-500">
        Already registered?{' '}
        <Link to="/login" className="font-black text-blue-600 hover:text-blue-700">
          Sign in
        </Link>
      </p>

      {showOtpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black text-slate-950">Verify Email</h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  Enter the 6-digit OTP sent to {formData.email}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowOtpModal(false)}
                className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={20} />
              </button>
            </div>

            {otpError && (
              <div className="mb-4 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
                {otpError}
              </div>
            )}

            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-bold text-slate-700">Verification OTP</label>
                <input
                  value={otp}
                  onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="h-14 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-center text-2xl font-black tracking-[0.4em] outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-50"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isVerifying || otp.length !== 6}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 text-sm font-black text-white shadow-sm shadow-blue-100 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <ShieldCheck size={18} />
                {isVerifying ? 'Verifying...' : 'Verify Account'}
              </button>
            </form>
          </div>
        </div>
      )}
    </AuthShell>
  );
};

export default SignupPage;
