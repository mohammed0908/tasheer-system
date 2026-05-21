import { Camera, KeyRound, Lock, Mail, Phone, Save, User } from 'lucide-react';

const inputClass = 'h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-500/20';
const iconInputClass = 'h-12 w-full rounded-lg border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-500/20';
const labelClass = 'mb-2 block text-sm font-black text-slate-700';

const StaffSettings = () => {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const roleLabel = user.job_title || user.department || user.role || 'Staff';

  return (
    <div className="space-y-6 bg-slate-50" dir="ltr">
      <div>
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-slate-400">Staff Portal / Account</p>
        <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Profile Settings</h2>
        <p className="mt-2 text-sm font-medium text-slate-500">Manage your staff profile, contact details, and password preferences.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <aside className="lg:col-span-1">
          <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
            <div className="h-24 rounded-t-2xl bg-blue-600" />
            <div className="-mt-12 flex flex-col items-center px-6 pb-8">
              <div className="relative">
                <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-white bg-white text-blue-600 shadow-sm">
                  <User size={42} />
                </div>
                <button
                  type="button"
                  className="absolute bottom-1 right-0 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-blue-600 text-white shadow-sm transition hover:bg-blue-700"
                  aria-label="Upload profile photo"
                >
                  <Camera size={16} />
                </button>
              </div>

              <div className="mt-5 text-center">
                <h3 className="text-xl font-black text-slate-950">{user.full_name || 'Staff'}</h3>
                <span className="mt-3 inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-blue-700">
                  {roleLabel}
                </span>
              </div>
            </div>
          </section>
        </aside>

        <section className="lg:col-span-2">
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm md:p-8">
            <div className="mb-6 flex items-center gap-3">
              <div className="rounded-2xl bg-blue-50 p-3 text-blue-600">
                <User size={22} />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-950">Basic Information</h3>
                <p className="text-sm font-medium text-slate-500">Keep your public staff profile accurate.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="fullName">Full Name</label>
                <input
                  id="fullName"
                  type="text"
                  defaultValue={user.full_name || ''}
                  placeholder="Enter full name"
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass} htmlFor="phoneNumber">Phone Number</label>
                <div className="relative">
                  <Phone className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="phoneNumber"
                    type="text"
                    placeholder="+60 12 345 6789"
                    className={iconInputClass}
                  />
                </div>
              </div>

              <div className="md:col-span-2">
                <label className={labelClass} htmlFor="emailAddress">Email Address</label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="emailAddress"
                    type="email"
                    defaultValue={user.email || ''}
                    disabled
                    className="h-12 w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-100 pl-11 pr-4 text-sm font-semibold text-slate-400 outline-none"
                  />
                </div>
              </div>
            </div>

            <hr className="my-8 border-slate-100" />

            <div className="mb-6 flex items-center gap-3">
              <div className="rounded-2xl bg-indigo-50 p-3 text-indigo-600">
                <KeyRound size={22} />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-950">Change Password</h3>
                <p className="text-sm font-medium text-slate-500">Use a strong password to protect your account.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <div>
                <label className={labelClass} htmlFor="currentPassword">Current Password</label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="currentPassword"
                    type="password"
                    placeholder="Current password"
                    className={iconInputClass}
                  />
                </div>
              </div>

              <div>
                <label className={labelClass} htmlFor="newPassword">New Password</label>
                <input
                  id="newPassword"
                  type="password"
                  placeholder="New password"
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass} htmlFor="confirmPassword">Confirm Password</label>
                <input
                  id="confirmPassword"
                  type="password"
                  placeholder="Confirm password"
                  className={inputClass}
                />
              </div>
            </div>

            <div className="mt-8 flex justify-end">
              <button
                type="button"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-black text-white shadow-sm shadow-blue-100 transition hover:bg-blue-700"
              >
                <Save size={17} />
                Save Changes
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default StaffSettings;
