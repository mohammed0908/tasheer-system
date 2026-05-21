import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { KeyRound, LogIn, Mail, ShieldCheck, X } from 'lucide-react';
import AuthShell from './AuthShell';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [forgotStep, setForgotStep] = useState('EMAIL');
  const [forgotData, setForgotData] = useState({
    email: '',
    otp: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [error, setError] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isForgotLoading, setIsForgotLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (event) => {
    event.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const res = await axios.post('/api/auth/login', { email, password });
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));

      if (res.data.user.role === 'admin') {
        navigate('/admin');
      } else if (res.data.user.role === 'staff') {
        navigate('/staff');
      } else {
        navigate('/client');
      }
    } catch (err) {
      if (err.response?.data?.requiresVerification) {
        navigate('/verify-email', { state: { email: err.response.data.email || email } });
        return;
      }
      setError(err.response?.data?.message || 'Failed to login');
    } finally {
      setIsLoading(false);
    }
  };

  const openForgotModal = () => {
    setForgotStep('EMAIL');
    setForgotError('');
    setForgotData(prev => ({ ...prev, email }));
    setShowForgotModal(true);
  };

  const closeForgotModal = () => {
    setShowForgotModal(false);
    setForgotError('');
    setForgotStep('EMAIL');
  };

  const handleForgotChange = (event) => {
    const { name, value } = event.target;
    setForgotData(prev => ({
      ...prev,
      [name]: name === 'otp' ? value.replace(/\D/g, '').slice(0, 6) : value
    }));
  };

  const handleForgotSubmit = async (event) => {
    event.preventDefault();
    setForgotError('');
    setIsForgotLoading(true);

    try {
      if (forgotStep === 'EMAIL') {
        const res = await axios.post('/api/auth/forgot-password', { email: forgotData.email });
        toast.success(res.data?.message || 'Reset OTP sent.');
        setForgotStep('OTP');
        return;
      }

      if (forgotStep === 'OTP') {
        setForgotStep('NEW_PASSWORD');
        return;
      }

      if (forgotData.newPassword !== forgotData.confirmPassword) {
        setForgotError('Passwords do not match');
        return;
      }

      const res = await axios.post('/api/auth/reset-password', {
        email: forgotData.email,
        otp: forgotData.otp,
        new_password: forgotData.newPassword
      });
      toast.success(res.data?.message || 'Password reset successfully.');
      closeForgotModal();
    } catch (err) {
      setForgotError(err.response?.data?.message || 'Unable to process password reset');
    } finally {
      setIsForgotLoading(false);
    }
  };

  return (
    <AuthShell title="Welcome Back" subtitle="Login to your TSMS dashboard">
      {error && (
        <div className="mb-4 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
          {error}
        </div>
      )}

      <form onSubmit={handleLogin} className="space-y-4">
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
          <div className="mb-1 flex items-center justify-between">
            <label className="block text-sm font-bold text-slate-700">Password</label>
            <button
              type="button"
              onClick={openForgotModal}
              className="text-xs font-black text-blue-600 hover:text-blue-700"
            >
              Forgot Password?
            </button>
          </div>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-50"
            required
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 text-sm font-black text-white shadow-sm shadow-blue-100 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <LogIn size={18} />
          {isLoading ? 'Signing In...' : 'Sign In'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm font-semibold text-slate-500">
        New student?{' '}
        <Link to="/signup" className="font-black text-blue-600 hover:text-blue-700">
          Create an account
        </Link>
      </p>

      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black text-slate-950">Reset Password</h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  {forgotStep === 'EMAIL' && 'Enter your email to receive a secure OTP.'}
                  {forgotStep === 'OTP' && 'Enter the 6-digit OTP sent to your inbox.'}
                  {forgotStep === 'NEW_PASSWORD' && 'Choose your new password.'}
                </p>
              </div>
              <button
                type="button"
                onClick={closeForgotModal}
                className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={20} />
              </button>
            </div>

            {forgotError && (
              <div className="mb-4 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
                {forgotError}
              </div>
            )}

            <form onSubmit={handleForgotSubmit} className="space-y-4">
              {forgotStep === 'EMAIL' && (
                <div>
                  <label className="mb-1 block text-sm font-bold text-slate-700">Email Address</label>
                  <input
                    type="email"
                    name="email"
                    value={forgotData.email}
                    onChange={handleForgotChange}
                    className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-50"
                    required
                  />
                </div>
              )}

              {forgotStep === 'OTP' && (
                <div>
                  <label className="mb-1 block text-sm font-bold text-slate-700">Reset OTP</label>
                  <input
                    name="otp"
                    value={forgotData.otp}
                    onChange={handleForgotChange}
                    className="h-14 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-center text-2xl font-black tracking-[0.4em] outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-50"
                    required
                  />
                </div>
              )}

              {forgotStep === 'NEW_PASSWORD' && (
                <>
                  <div>
                    <label className="mb-1 block text-sm font-bold text-slate-700">New Password</label>
                    <input
                      type="password"
                      name="newPassword"
                      value={forgotData.newPassword}
                      onChange={handleForgotChange}
                      className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-50"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-bold text-slate-700">Confirm Password</label>
                    <input
                      type="password"
                      name="confirmPassword"
                      value={forgotData.confirmPassword}
                      onChange={handleForgotChange}
                      className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-50"
                      required
                    />
                  </div>
                </>
              )}

              <button
                type="submit"
                disabled={isForgotLoading || (forgotStep === 'OTP' && forgotData.otp.length !== 6)}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 text-sm font-black text-white shadow-sm shadow-blue-100 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {forgotStep === 'EMAIL' && <Mail size={18} />}
                {forgotStep === 'OTP' && <ShieldCheck size={18} />}
                {forgotStep === 'NEW_PASSWORD' && <KeyRound size={18} />}
                {isForgotLoading && 'Please wait...'}
                {!isForgotLoading && forgotStep === 'EMAIL' && 'Send OTP'}
                {!isForgotLoading && forgotStep === 'OTP' && 'Continue'}
                {!isForgotLoading && forgotStep === 'NEW_PASSWORD' && 'Reset Password'}
              </button>
            </form>
          </div>
        </div>
      )}
    </AuthShell>
  );
};

export default LoginPage;
