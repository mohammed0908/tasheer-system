const AuthShell = ({ title, subtitle, children }) => (
  <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10" dir="ltr">
    <div className="w-full max-w-md rounded-2xl border border-slate-100 bg-white p-8 shadow-sm">
      <div className="mb-8 text-center">
        <img src="/logo.png" alt="Tasheer Agency Logo" className="mx-auto h-24 w-auto object-contain" />
        <h1 className="mt-5 text-2xl font-black tracking-tight text-slate-950">{title}</h1>
        <p className="mt-2 text-sm font-semibold text-slate-500">{subtitle}</p>
      </div>
      {children}
    </div>
  </div>
);

export default AuthShell;
