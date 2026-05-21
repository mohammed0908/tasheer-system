import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Activity, ArrowRight, CalendarDays, CheckCircle2, Clock3, CreditCard, FileCheck2, FileText, FileUp, Flag, MessageCircle, PieChart as PieChartIcon, RefreshCw, Send, Target, TrendingUp, UserPlus, WalletCards } from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

const formatCurrentDate = () => {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  }).format(new Date());
};

const actionTypeStyles = {
  application: { icon: FileText, iconClass: 'bg-blue-50 text-blue-600', label: 'Review' },
  message: { icon: MessageCircle, iconClass: 'bg-emerald-50 text-emerald-600', label: 'Reply' },
  invoice: { icon: CreditCard, iconClass: 'bg-amber-50 text-amber-600', label: 'Open' },
  system: { icon: Flag, iconClass: 'bg-indigo-50 text-indigo-600', label: 'Action' }
};

const urgencyStyles = {
  Normal: 'bg-blue-50 text-blue-700 border-blue-100',
  Warning: 'bg-amber-50 text-amber-700 border-amber-100',
  Critical: 'bg-rose-50 text-rose-700 border-rose-100'
};

const calculateSLA = (createdAtDate) => {
  if (!createdAtDate) {
    return { label: 'Pending', urgency: 'Normal' };
  }

  const createdAt = new Date(createdAtDate);
  const diffMs = Date.now() - createdAt.getTime();
  const diffHours = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60)));
  const diffDays = Math.floor(diffHours / 24);
  const urgency = diffHours > 48 ? 'Critical' : diffHours > 24 ? 'Warning' : 'Normal';

  if (diffDays > 0) {
    return { label: `Pending for ${diffDays} ${diffDays === 1 ? 'day' : 'days'}`, urgency };
  }

  if (diffHours > 0) {
    return { label: `Pending for ${diffHours} ${diffHours === 1 ? 'hr' : 'hrs'}`, urgency };
  }

  return { label: 'Pending just now', urgency };
};

const goalCardStyles = [
  { iconBg: 'bg-purple-50 text-purple-600', stroke: '#8b5cf6' },
  { iconBg: 'bg-emerald-50 text-emerald-600', stroke: '#10b981' },
  { iconBg: 'bg-amber-50 text-amber-600', stroke: '#f59e0b' },
  { iconBg: 'bg-blue-50 text-blue-600', stroke: '#3b82f6' }
];

const formatGoalValue = (value) => {
  if (value === undefined || value === null || value === '') return '-';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(Number(value));
};

const departmentAliases = {
  Ops: 'Operations',
  Accountant: 'Finance',
  'Financial Manager': 'Finance',
  'Junior Counselor': 'Counselor',
  'Senior Counselor': 'Counselor',
  'Customer Service Officer': 'Customer Service'
};

const normalizeDepartment = (user) => (
  departmentAliases[user?.department] ||
  departmentAliases[user?.job_title] ||
  user?.department ||
  user?.job_title ||
  ''
);

const statusBadgeStyles = {
  PENDING_DOCS: 'bg-rose-50 text-rose-700 border-rose-100',
  DOCS_VERIFICATION: 'bg-blue-50 text-blue-700 border-blue-100',
  APPLIED_FOR_OL: 'bg-indigo-50 text-indigo-700 border-indigo-100',
  WAITING_FOR_OL: 'bg-cyan-50 text-cyan-700 border-cyan-100',
  PENDING_OFFER_APPLY: 'bg-amber-50 text-amber-700 border-amber-100',
  OFFER_PROCESSING: 'bg-blue-50 text-blue-700 border-blue-100',
  OFFER_UPLOADED: 'bg-violet-50 text-violet-700 border-violet-100',
  OFFER_APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  PENDING_INVOICE_APPROVAL: 'bg-orange-50 text-orange-700 border-orange-100',
  PENDING_PAYMENT: 'bg-yellow-50 text-yellow-700 border-yellow-100',
  PAYMENT_VERIFIED: 'bg-green-50 text-green-700 border-green-100',
  VISA_PROCESSING: 'bg-cyan-50 text-cyan-700 border-cyan-100',
  VISA_COMPLETED: 'bg-emerald-50 text-emerald-700 border-emerald-100'
};

const chartColors = ['#2563eb', '#0ea5e9', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#14b8a6', '#6366f1'];

const getApiErrorMessage = (err, fallback = 'Failed to create application.') => (
  err.response?.data?.error ||
  err.response?.data?.message ||
  err.message ||
  fallback
);

const ProgressRing = ({ value, color, trail }) => {
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="relative flex h-36 w-36 items-center justify-center">
      <svg className="h-36 w-36 -rotate-90" viewBox="0 0 120 120" aria-hidden="true">
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke={trail}
          strokeWidth="12"
        />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute text-center">
        <p className="text-3xl font-black tracking-tight text-slate-950">{value}%</p>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Score</p>
      </div>
    </div>
  );
};

const GoalProgressRing = ({ value, color, subtitle }) => {
  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  const clampedValue = Math.min(Math.max(value, 0), 100);
  const offset = circumference - (clampedValue / 100) * circumference;

  return (
    <div className="relative mx-auto my-4 flex h-32 w-32 items-center justify-center">
      <svg className="h-32 w-32 -rotate-90" viewBox="0 0 128 128" aria-hidden="true">
        <circle
          cx="64"
          cy="64"
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="12"
        />
        <circle
          cx="64"
          cy="64"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute text-center">
        <p className="text-3xl font-black tracking-tight text-slate-950">{Math.round(value)}%</p>
        <p className="text-xs font-black text-slate-400">{subtitle}</p>
      </div>
    </div>
  );
};

const StaffDashboard = () => {
  const navigate = useNavigate();
  const [activeTasks, setActiveTasks] = useState([]);
  const [goals, setGoals] = useState([]);
  const [applications, setApplications] = useState([]);
  const [staffMembers, setStaffMembers] = useState([]);
  const [staffMetrics, setStaffMetrics] = useState({ performance_score: 0, completed_tasks: 0, total_tasks: 0 });
  const [isTasksLoading, setIsTasksLoading] = useState(true);
  const [isLifecycleLoading, setIsLifecycleLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [actionError, setActionError] = useState('');
  const [offerFiles, setOfferFiles] = useState({});
  const [visaFiles, setVisaFiles] = useState({});
  const [visaInputs, setVisaInputs] = useState({});
  const [csForm, setCsForm] = useState({
    full_name: '',
    email: '',
    university_name: '',
    study_program: '',
    counselor_id: ''
  });
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('user') || '{}'));
  const userDepartment = normalizeDepartment(user);
  const userRoleLabel = user.job_title || user.department || user.role || 'Staff';
  const authHeaders = useCallback(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      console.error('Fetch Failed:', 'Missing auth token for StaffDashboard request.');
      return {};
    }
    return { Authorization: `Bearer ${token}` };
  }, []);

  const getGoalScore = (goal) => {
    if (goal.goal_type === 'milestone') {
      if (goal.status === 'Completed') return 100;
      if (goal.status === 'In Progress') return 50;
      return 0;
    }

    const current = Number(goal.current_value || 0);
    const target = Number(goal.target_value || 0);
    if (target <= 0) return 0;
    return (current / target) * 100;
  };

  const totalScore = goals.reduce((sum, goal) => sum + getGoalScore(goal), 0);
  const masterProgress = goals.length > 0 ? Math.round(totalScore / goals.length) : 0;
  const completedCount = goals.filter(goal => (
    goal.goal_type === 'milestone'
      ? goal.status === 'Completed'
      : Number(goal.current_value || 0) >= Number(goal.target_value || 0) && Number(goal.target_value || 0) > 0
  )).length;
  const notStartedCount = goals.filter(goal => (
    goal.goal_type === 'milestone'
      ? goal.status === 'Not Started'
      : Number(goal.current_value || 0) === 0
  )).length;
  const inProgressCount = Math.max(goals.length - completedCount - notStartedCount, 0);
  const performanceMetrics = [
    { label: 'Task Completion', value: Number(staffMetrics.performance_score || 0), color: '#4f46e5', trail: '#e0e7ff' },
    { label: 'Completed Tasks', value: staffMetrics.total_tasks > 0 ? Math.round((Number(staffMetrics.completed_tasks || 0) / Number(staffMetrics.total_tasks || 1)) * 100) : 0, color: '#10b981', trail: '#d1fae5' },
    { label: 'Open Workload', value: staffMetrics.total_tasks > 0 ? Math.round(((Number(staffMetrics.total_tasks || 0) - Number(staffMetrics.completed_tasks || 0)) / Number(staffMetrics.total_tasks || 1)) * 100) : 0, color: '#f59e0b', trail: '#fef3c7' }
  ];

  const fetchActiveTasks = useCallback(async ({ showLoading = true } = {}) => {
    try {
      if (showLoading) setIsTasksLoading(true);
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/staff/me/active-actions', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setActiveTasks(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error('Failed to fetch active actions:', error);
      setActiveTasks([]);
    } finally {
      setIsTasksLoading(false);
    }
  }, []);

  const fetchStaffMetrics = useCallback(async () => {
    try {
      const res = await axios.get('/api/staff/me/metrics', { headers: authHeaders() });
      setStaffMetrics(res.data || { performance_score: 0, completed_tasks: 0, total_tasks: 0 });
    } catch (error) {
      console.error('Failed to fetch staff metrics:', error);
      setStaffMetrics({ performance_score: 0, completed_tasks: 0, total_tasks: 0 });
    }
  }, [authHeaders]);

  const fetchLifecycleData = useCallback(async ({ showLoading = true } = {}) => {
    try {
      if (showLoading) setIsLifecycleLoading(true);
      const [applicationsRes, staffRes] = await Promise.all([
        axios.get('/api/applications', { headers: authHeaders() }),
        axios.get('/api/staff?department=Counselor', { headers: authHeaders() })
      ]);
      console.log('Raw API Response:', applicationsRes);
      const applicationsData = applicationsRes.data?.applications || applicationsRes.data?.data || applicationsRes.data;
      setApplications(Array.isArray(applicationsData) ? applicationsData : []);
      setStaffMembers(Array.isArray(staffRes.data) ? staffRes.data : []);
    } catch (error) {
      console.error('Fetch Failed:', error.response?.data || error.message);
      setApplications([]);
      setStaffMembers([]);
    } finally {
      setIsLifecycleLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const res = await axios.get('/api/auth/me', { headers: authHeaders() });
        const nextUser = res.data || {};
        setUser(nextUser);
        localStorage.setItem('user', JSON.stringify(nextUser));
        window.dispatchEvent(new Event('userUpdated'));
      } catch (error) {
        console.error('Failed to refresh staff profile:', error);
      }
    };

    const timer = window.setTimeout(fetchCurrentUser, 0);
    return () => window.clearTimeout(timer);
  }, [authHeaders]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetchLifecycleData({ showLoading: false });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchLifecycleData]);

  useEffect(() => {
    const timer = window.setTimeout(fetchStaffMetrics, 0);
    return () => window.clearTimeout(timer);
  }, [fetchStaffMetrics]);

  useEffect(() => {
    const fetchGoals = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get('/api/goals', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setGoals(Array.isArray(res.data) ? res.data : []);
      } catch (error) {
        console.error('Failed to fetch management goals:', error);
      }
    };

    const timer = window.setTimeout(fetchGoals, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetchActiveTasks({ showLoading: false });
    }, 0);

    return () => window.clearTimeout(timer);
  }, [fetchActiveTasks]);

  const handleAdvanceState = async (applicationId, newStatus, extraData = {}) => {
    try {
      setActionLoading(`${applicationId}-${newStatus}`);
      await axios.put(`/api/applications/${applicationId}/advance-state`, {
        new_status: newStatus,
        ...extraData
      }, { headers: authHeaders() });
      await fetchLifecycleData({ showLoading: false });
      await fetchActiveTasks({ showLoading: false });
      await fetchStaffMetrics();
    } catch (error) {
      console.error(`Failed to advance application to ${newStatus}:`, error);
    } finally {
      setActionLoading('');
    }
  };

  const handleCreateCsApplication = async (event) => {
    event.preventDefault();
    try {
      setActionLoading('create-cs-application');
      setActionError('');
      const res = await axios.post('/api/applications', csForm, { headers: authHeaders() });
      const applicationId = res.data.application_id || res.data.applicationId;
      if (applicationId) {
        await axios.put(`/api/applications/${applicationId}/advance-state`, {
          new_status: 'DOCS_VERIFICATION'
        }, { headers: authHeaders() });
      }
      setCsForm({ full_name: '', email: '', university_name: '', study_program: '', counselor_id: '' });
      await fetchLifecycleData({ showLoading: false });
    } catch (error) {
      console.error('Failed to create CS application:', error);
      setActionError(getApiErrorMessage(error));
    } finally {
      setActionLoading('');
    }
  };

  const handleOfferUpload = async (applicationId) => {
    const file = offerFiles[applicationId];
    if (!file) return;

    try {
      setActionLoading(`${applicationId}-OFFER_UPLOADED`);
      const payload = new FormData();
      payload.append('new_status', 'OFFER_UPLOADED');
      payload.append('offer_letter', file);
      await axios.put(`/api/applications/${applicationId}/advance-state`, payload, {
        headers: {
          ...authHeaders(),
          'Content-Type': 'multipart/form-data'
        }
      });
      setOfferFiles(prev => ({ ...prev, [applicationId]: null }));
      await fetchLifecycleData({ showLoading: false });
    } catch (error) {
      console.error('Failed to upload offer letter:', error);
    } finally {
      setActionLoading('');
    }
  };

  const handleVisaApplied = async (applicationId) => {
    const file = visaFiles[applicationId];
    if (!file) return;

    try {
      setActionLoading(`${applicationId}-VISA_PROCESSING`);
      const payload = new FormData();
      payload.append('new_status', 'VISA_PROCESSING');
      payload.append('visa_document', file);
      await axios.put(`/api/applications/${applicationId}/advance-state`, payload, {
        headers: {
          ...authHeaders(),
          'Content-Type': 'multipart/form-data'
        }
      });
      setVisaFiles(prev => ({ ...prev, [applicationId]: null }));
      await fetchLifecycleData({ showLoading: false });
      await fetchActiveTasks({ showLoading: false });
      await fetchStaffMetrics();
    } catch (error) {
      console.error('Failed to mark visa as applied:', error);
    } finally {
      setActionLoading('');
    }
  };

  const handleVisaProgressUpdate = async (applicationId) => {
    try {
      setActionLoading(`${applicationId}-visa-progress`);
      await axios.put(`/api/applications/${applicationId}/visa-progress`, {
        visa_progress: Number(visaInputs[applicationId] || 0)
      }, { headers: authHeaders() });
      await fetchLifecycleData({ showLoading: false });
    } catch (error) {
      console.error('Failed to update visa progress:', error);
    } finally {
      setActionLoading('');
    }
  };

  const getTaskActionTarget = (task) => {
    if (task.action_link && task.action_link !== '/staff') return task.action_link;
    if (task.type === 'invoice') return '/staff/invoices';
    if (task.type === 'message' || task.type === 'chat') return '/staff/messages';
    if (task.app_uid) return `/staff/clients?openApp=${encodeURIComponent(task.app_uid)}`;
    return '/staff';
  };

  const handleCompleteTask = async (taskId) => {
    if (!taskId) return;

    try {
      setActionLoading(`complete-task-${taskId}`);
      await axios.put(`/api/tasks/${taskId}/complete`, {}, { headers: authHeaders() });
      await fetchActiveTasks({ showLoading: false });
      await fetchStaffMetrics();
    } catch (error) {
      console.error('Failed to complete task:', error);
    } finally {
      setActionLoading('');
    }
  };

  const counselors = (staffMembers || []).filter(member => normalizeDepartment(member) === 'Counselor');
  const visibleApplications = (applications || []).filter(app => {
    if (userDepartment === 'Customer Service') {
      return Number(app?.created_by_cs_id) === Number(user?.id);
    }
    if (userDepartment === 'Counselor') {
      return (
        Number(app?.counselor_id) === Number(user?.id) ||
        Number(app?.assigned_staff_id) === Number(user?.id) ||
        Number(app?.created_by_cs_id) === Number(user?.id)
      );
    }
    return true;
  });
  const counselorApplications = visibleApplications.filter(app => ['LEAD', 'DOCS_VERIFICATION', 'OFFER_UPLOADED', 'OFFER_APPROVED', 'VISA_PROCESSING'].includes(app?.status));
  const operationsApplications = visibleApplications.filter(app => ['PENDING_OFFER_APPLY', 'OFFER_PROCESSING', 'PAYMENT_VERIFIED'].includes(app?.status));
  const getAppId = (app) => app?.app_id || app?.id;
  const statusDistributionData = Object.entries(staffMetrics.status_distribution || {}).map(([status, count]) => ({
    name: status.replace(/_/g, ' '),
    value: Number(count || 0)
  }));
  const activeGoals = Array.isArray(staffMetrics.active_goals) ? staffMetrics.active_goals : [];
  const personalizedKpis = [
    { label: 'Total Orders (My Apps)', value: Number(staffMetrics.total_orders || 0), icon: FileText, accent: 'bg-blue-50 text-blue-600 border-blue-100' },
    { label: 'Total Pending Tasks', value: Number(staffMetrics.pending_tasks || 0), icon: Clock3, accent: 'bg-amber-50 text-amber-600 border-amber-100' },
    { label: 'Active Goals', value: Number(staffMetrics.active_goals_count ?? activeGoals.length), icon: Target, accent: 'bg-emerald-50 text-emerald-600 border-emerald-100' }
  ];

  return (
    <div className="space-y-6 bg-slate-50" dir="ltr">
      <section className="overflow-hidden rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-cyan-50 p-6 shadow-sm md:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-white/80 px-3 py-2 text-sm font-bold text-indigo-700 shadow-sm">
              <CalendarDays size={16} />
              {formatCurrentDate()}
            </div>
            <h2 className="text-3xl font-black tracking-tight text-slate-950 md:text-4xl">
              Welcome, {user.full_name || 'Staff'}
            </h2>
            <p className="mt-3 max-w-2xl text-base leading-7 text-slate-500">
              Your staff workspace is ready. Review goals, track management performance, and keep client operations moving.
            </p>
          </div>

          <div className="rounded-2xl border border-white/70 bg-white/80 p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Current Role</p>
            <p className="mt-2 text-2xl font-black text-indigo-700">{userRoleLabel}</p>
            <div className="mt-4 flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              Connected Now
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {personalizedKpis.map(kpi => {
          const Icon = kpi.icon;
          return (
            <article key={kpi.label} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className={`mb-4 inline-flex rounded-xl border p-2.5 ${kpi.accent}`}>
                <Icon size={20} />
              </div>
              <p className="text-3xl font-black text-slate-950">{kpi.value}</p>
              <p className="mt-2 text-xs font-bold leading-5 text-slate-500">{kpi.label}</p>
            </article>
          );
        })}
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <article className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm lg:col-span-2">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-slate-400">My Workload</p>
              <h2 className="mt-1 text-xl font-black text-slate-950">Application Status Distribution</h2>
            </div>
            <PieChartIcon className="text-slate-300" size={26} />
          </div>
          <div className="h-80">
            {statusDistributionData.length === 0 ? (
              <div className="flex h-full items-center justify-center rounded-2xl bg-slate-50 text-sm font-bold text-slate-500">
                No application workload data yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusDistributionData} dataKey="value" nameKey="name" innerRadius={62} outerRadius={108} paddingAngle={3}>
                    {statusDistributionData.map((entry, index) => (
                      <Cell key={entry.name} fill={chartColors[index % chartColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </article>

        <article className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-slate-400">Assigned Goals</p>
          <h2 className="mt-1 text-xl font-black text-slate-950">My Active Goals</h2>
          <div className="mt-5 space-y-3">
            {activeGoals.length === 0 ? (
              <p className="rounded-2xl bg-slate-50 p-5 text-sm font-bold text-slate-500">No active goals assigned directly to you.</p>
            ) : activeGoals.slice(0, 4).map(goal => {
              const current = Number(goal.current_value || 0);
              const target = Number(goal.target_value || 0);
              const progress = goal.goal_type === 'milestone'
                ? goal.status === 'Completed' ? 100 : goal.status === 'In Progress' ? 50 : 0
                : target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;

              return (
                <div key={goal.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-slate-900">{goal.title}</p>
                      <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">{goal.goal_type}</p>
                    </div>
                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-emerald-700 shadow-sm">{progress}%</span>
                  </div>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200">
                    <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} />
                  </div>
                  {goal.goal_type === 'numeric' && (
                    <p className="mt-2 text-xs font-bold text-slate-500">{current} / {target}</p>
                  )}
                </div>
              );
            })}
          </div>
        </article>
      </section>

      {['Customer Service', 'Counselor', 'Operations'].includes(userDepartment) && (
        <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-slate-400">Department Actions</p>
              <h2 className="mt-1 text-xl font-black text-slate-950">{userDepartment} Action Queue</h2>
            </div>
            <button
              type="button"
              onClick={() => fetchLifecycleData({ showLoading: false })}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-black text-slate-600 hover:bg-slate-200"
            >
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>

          {actionError && (
            <div className="mb-4 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-black text-rose-700">
              {actionError}
            </div>
          )}

          {userDepartment === 'Customer Service' && (
            <form onSubmit={handleCreateCsApplication} className="grid grid-cols-1 gap-4 lg:grid-cols-6">
              <input
                value={csForm.full_name}
                onChange={event => setCsForm(prev => ({ ...prev, full_name: event.target.value }))}
                placeholder="Client full name"
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500 lg:col-span-2"
                required
              />
              <input
                type="email"
                value={csForm.email}
                onChange={event => setCsForm(prev => ({ ...prev, email: event.target.value }))}
                placeholder="Client email"
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500 lg:col-span-2"
                required
              />
              <select
                value={csForm.counselor_id}
                onChange={event => setCsForm(prev => ({ ...prev, counselor_id: event.target.value }))}
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500 lg:col-span-2"
                required
              >
                <option value="">Assign counselor</option>
                {counselors.map(counselor => (
                  <option key={counselor.id} value={counselor.id}>{counselor.full_name}</option>
                ))}
              </select>
              <input
                value={csForm.university_name}
                onChange={event => setCsForm(prev => ({ ...prev, university_name: event.target.value }))}
                placeholder="Target university"
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500 lg:col-span-2"
                required
              />
              <input
                value={csForm.study_program}
                onChange={event => setCsForm(prev => ({ ...prev, study_program: event.target.value }))}
                placeholder="Study program"
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500 lg:col-span-2"
                required
              />
              <button
                type="submit"
                disabled={actionLoading === 'create-cs-application'}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white shadow-sm hover:bg-blue-700 disabled:opacity-60 lg:col-span-2"
              >
                <UserPlus size={16} />
                {actionLoading === 'create-cs-application' ? 'Creating...' : 'Create & Verify Docs'}
              </button>
            </form>
          )}

          {userDepartment === 'Counselor' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="p-3">Student</th>
                    <th className="p-3">Program</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLifecycleLoading ? (
                    <tr><td colSpan="4" className="p-6 text-center text-slate-500">Loading applications...</td></tr>
                  ) : counselorApplications.length === 0 ? (
                    <tr><td colSpan="4" className="p-6 text-center text-slate-500">No counselor actions waiting.</td></tr>
                  ) : counselorApplications.map(app => (
                    <tr key={getAppId(app)}>
                      <td className="p-3 font-black text-slate-800">
                        {app.student_name}
                        <span className="ml-2 rounded-full bg-blue-50 px-2 py-1 text-[11px] font-black text-blue-700">{app.app_uid}</span>
                      </td>
                      <td className="p-3 text-slate-600">{app.university_name} / {app.program_name}</td>
                      <td className="p-3">
                        <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusBadgeStyles[app.status] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                          {app.status}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        {['LEAD', 'DOCS_VERIFICATION'].includes(app.status) && (
                          <button
                            type="button"
                            onClick={() => navigate(app.app_uid ? `/staff/clients?openApp=${encodeURIComponent(app.app_uid)}` : '/staff/clients')}
                            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-xs font-black text-white hover:bg-blue-700 disabled:opacity-50"
                          >
                            <FileCheck2 size={15} />
                            Review Application
                          </button>
                        )}
                        {['PENDING_OFFER_APPLY', 'OFFER_PROCESSING'].includes(app.status) && (
                          <span className="inline-flex rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-black text-blue-700">
                            Waiting on Operations to process the offer letter...
                          </span>
                        )}
                        {app.status === 'OFFER_UPLOADED' && (
                          <div className="inline-flex flex-wrap justify-end gap-2">
                            {app.offer_letter_url && (
                              <a href={app.offer_letter_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-black text-blue-700 hover:bg-blue-100">
                                <FileText size={15} /> View Uploaded Offer
                              </a>
                            )}
                            <button type="button" onClick={() => handleAdvanceState(getAppId(app), 'OFFER_APPROVED')} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white hover:bg-emerald-700">
                              <CheckCircle2 size={15} /> Approved OL
                            </button>
                          </div>
                        )}
                        {app.status === 'OFFER_APPROVED' && (
                          <button type="button" onClick={() => navigate('/staff/invoices')} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-black text-white hover:bg-indigo-700">
                            <WalletCards size={15} /> Create Invoice
                          </button>
                        )}
                        {app.status === 'VISA_PROCESSING' && (
                          <div className="inline-flex max-w-lg flex-wrap items-center justify-end gap-2">
                            <input
                              type="range"
                              min="0"
                              max="100"
                              value={visaInputs[getAppId(app)] ?? app.visa_progress ?? 0}
                              onChange={event => setVisaInputs(prev => ({ ...prev, [getAppId(app)]: event.target.value }))}
                              className="w-28"
                            />
                            <span className="w-10 text-xs font-black text-slate-600">{visaInputs[getAppId(app)] ?? app.visa_progress ?? 0}%</span>
                            <button type="button" onClick={() => handleVisaProgressUpdate(getAppId(app))} className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-black text-white hover:bg-blue-700">
                              Update Progress
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAdvanceState(getAppId(app), 'VISA_COMPLETED')}
                              disabled={actionLoading === `${getAppId(app)}-VISA_COMPLETED`}
                              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white hover:bg-emerald-700 disabled:opacity-50"
                            >
                              <CheckCircle2 size={15} />
                              {actionLoading === `${getAppId(app)}-VISA_COMPLETED` ? 'Updating...' : 'Visa Completed'}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {userDepartment === 'Operations' && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {isLifecycleLoading ? (
                <div className="rounded-2xl bg-slate-50 p-6 text-center text-sm font-bold text-slate-500 lg:col-span-2">Loading offer applications...</div>
              ) : operationsApplications.length === 0 ? (
                <div className="rounded-2xl bg-slate-50 p-6 text-center text-sm font-bold text-slate-500 lg:col-span-2">No offer letters or visa applications waiting.</div>
              ) : operationsApplications.map(app => (
                <article key={getAppId(app)} className="rounded-2xl border border-slate-100 bg-slate-50 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-black text-slate-900">{app.student_name}</h3>
                      <p className="mt-1 text-xs font-black text-blue-700">{app.app_uid}</p>
                      <p className="mt-1 text-sm font-semibold text-slate-500">{app.university_name} / {app.program_name}</p>
                    </div>
                    <span className="rounded-full border border-amber-100 bg-amber-50 px-3 py-1 text-xs font-black text-amber-700">{app.status}</span>
                  </div>
                  {app.status === 'PENDING_OFFER_APPLY' && (
                    <button
                      type="button"
                      onClick={() => handleAdvanceState(getAppId(app), 'OFFER_PROCESSING')}
                      disabled={actionLoading === `${getAppId(app)}-OFFER_PROCESSING`}
                      className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      <FileCheck2 size={16} />
                      Begin Offer Application
                    </button>
                  )}

                  {app.status === 'OFFER_PROCESSING' && (
                    <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                      <label className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-white px-4 py-3 text-sm font-black text-slate-500 hover:bg-slate-100">
                        <FileUp size={16} />
                        {offerFiles[getAppId(app)]?.name || 'Choose offer letter'}
                        <input
                          type="file"
                          accept=".pdf,image/*"
                          className="hidden"
                          onChange={event => setOfferFiles(prev => ({ ...prev, [getAppId(app)]: event.target.files?.[0] || null }))}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => handleOfferUpload(getAppId(app))}
                        disabled={!offerFiles[getAppId(app)] || actionLoading === `${getAppId(app)}-OFFER_UPLOADED`}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        <Send size={16} />
                        Upload Offer Letter
                      </button>
                    </div>
                  )}

                  {app.status === 'PAYMENT_VERIFIED' && (
                    <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                      <label className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-white px-4 py-3 text-sm font-black text-slate-500 hover:bg-slate-100">
                        <FileUp size={16} />
                        {visaFiles[getAppId(app)]?.name || 'Upload visa document'}
                        <input
                          type="file"
                          accept=".pdf,image/*"
                          className="hidden"
                          onChange={event => setVisaFiles(prev => ({ ...prev, [getAppId(app)]: event.target.files?.[0] || null }))}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => handleVisaApplied(getAppId(app))}
                        disabled={!visaFiles[getAppId(app)] || actionLoading === `${getAppId(app)}-VISA_PROCESSING`}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        <FileCheck2 size={16} />
                        Visa Applied
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}

        </section>
      )}

      <section className="space-y-6">
        <div className="relative mb-8 overflow-hidden rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-purple-50" />
          <div className="relative flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-purple-100 text-purple-700">
                <PieChartIcon size={30} />
              </div>
              <div>
                <h2 className="text-2xl font-black tracking-tight text-slate-950">General Management Goals</h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">Hybrid progress across numeric targets and milestones.</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-indigo-700 px-4 py-2 text-xs font-black text-white shadow-sm">
                Total: {goals.length}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-4 py-2 text-xs font-black text-emerald-700">
                <CheckCircle2 size={14} />
                Completed: {completedCount}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-4 py-2 text-xs font-black text-amber-700">
                <Activity size={14} />
                In Progress: {inProgressCount}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-4 py-2 text-xs font-black text-slate-600">
                <Clock3 size={14} />
                Not Started: {notStartedCount}
              </span>
            </div>
          </div>

          <div className="relative mt-8">
            <div className="mb-3 flex justify-end">
              <p className="text-sm font-black text-slate-700">Total Progress: {masterProgress}%</p>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-purple-500 to-blue-500"
                style={{ width: `${Math.min(masterProgress, 100)}%` }}
              />
            </div>
          </div>
        </div>

        {goals.length === 0 ? (
          <div className="rounded-3xl border border-slate-100 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-50 text-slate-300">
              <Target size={30} />
            </div>
            <p className="mt-4 text-lg font-black text-slate-800">No management goals yet</p>
            <p className="mt-1 text-sm font-semibold text-slate-500">Admin-created goals will appear here automatically.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {goals.map((goal, index) => {
              const style = goalCardStyles[index % goalCardStyles.length];
              const progress = Math.min(Math.max(getGoalScore(goal), 0), 100);
              const isMilestone = goal.goal_type === 'milestone';
              const subtitle = progress >= 80 ? 'Excellent' : progress >= 50 ? 'On Track' : progress > 0 ? 'Building' : 'Pending';

              return (
                <article key={goal.id} className="flex flex-col rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="line-clamp-2 text-base font-black leading-6 text-slate-950">{goal.title}</h3>
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${style.iconBg}`}>
                      {isMilestone ? <Flag size={20} /> : <TrendingUp size={20} />}
                    </div>
                  </div>

                  <GoalProgressRing value={progress} color={style.stroke} subtitle={subtitle} />

                  <div className="grid grid-cols-2 gap-3">
                    {isMilestone ? (
                      <>
                        <div className="rounded-xl bg-slate-50 p-3 text-center">
                          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Type</p>
                          <p className="mt-1 text-sm font-black text-slate-800">Milestone</p>
                        </div>
                        <div className="rounded-xl bg-slate-50 p-3 text-center">
                          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Status</p>
                          <p className="mt-1 text-sm font-black text-slate-800">{goal.status || '-'}</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="rounded-xl bg-slate-50 p-3 text-center">
                          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Target</p>
                          <p className="mt-1 text-sm font-black text-slate-800">{formatGoalValue(goal.target_value)}</p>
                        </div>
                        <div className="rounded-xl bg-slate-50 p-3 text-center">
                          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Current</p>
                          <p className="mt-1 text-sm font-black text-slate-800">{formatGoalValue(goal.current_value)}</p>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="mt-5 border-t border-slate-100 pt-4">
                    <span className="inline-flex rounded-full bg-slate-50 px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                      {goal.department || 'All Departments'}
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {performanceMetrics.map(metric => (
          <article key={metric.label} className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <div className="mb-6">
              <p className="text-sm font-bold text-slate-400">Performance Metric</p>
              <h3 className="mt-1 text-lg font-black text-slate-950">{metric.label}</h3>
            </div>
            <div className="flex justify-center">
              <ProgressRing value={metric.value} color={metric.color} trail={metric.trail} />
            </div>
            <div className="mt-6 rounded-2xl bg-slate-50 px-4 py-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-bold text-slate-500">Monthly target</span>
                <span className="font-black text-slate-900">{metric.value >= 60 ? 'On Track' : 'Needs Focus'}</span>
              </div>
            </div>
          </article>
        ))}
      </section>

      <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-black text-slate-950">My Active Tasks</h2>
            <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-black text-indigo-700">
              {activeTasks.length}
            </span>
          </div>
          <p className="text-sm font-medium text-slate-500">Review assigned work and move each task to the next state.</p>
        </div>

        {isTasksLoading ? (
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-8 text-center text-sm font-bold text-slate-500">
            Loading active tasks...
          </div>
        ) : activeTasks.length === 0 ? (
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-8 text-center">
            <p className="font-black text-slate-700">No active tasks right now.</p>
            <p className="mt-1 text-sm font-medium text-slate-500">Completed or new assignments will update this area automatically.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeTasks.map(task => {
              const typeConfig = actionTypeStyles[task.type] || actionTypeStyles.system;
              const Icon = typeConfig.icon;
              const sla = calculateSLA(task.created_at);

              return (
                <article key={task.id} className="flex flex-col gap-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition hover:border-blue-100 hover:shadow-md sm:flex-row sm:items-center">
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${typeConfig.iconClass}`}>
                    <Icon size={22} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-base font-black text-slate-950">{task.title || 'Action Required'}</h3>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">
                        {task.type || 'system'}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-sm font-semibold text-slate-500">{task.subtitle || 'Open this item to continue.'}</p>
                    <span className={`mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-black ${urgencyStyles[sla.urgency] || urgencyStyles.Normal}`}>
                      {sla.label}
                    </span>
                  </div>

                  {task.task_id && !task.app_uid && task.type === 'system' ? (
                    <button
                      type="button"
                      onClick={() => handleCompleteTask(task.task_id)}
                      disabled={actionLoading === `complete-task-${task.task_id}`}
                      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
                    >
                      {actionLoading === `complete-task-${task.task_id}` ? 'Saving...' : 'Mark as Done'}
                      <CheckCircle2 size={16} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => navigate(getTaskActionTarget(task))}
                      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-blue-700"
                    >
                      {typeConfig.label}
                      <ArrowRight size={16} />
                    </button>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

export default StaffDashboard;
