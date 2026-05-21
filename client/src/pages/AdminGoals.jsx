import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Loader2, Pencil, Plus, Save, Target, Trash2, X } from 'lucide-react';

const statuses = ['Not Started', 'In Progress', 'Completed'];
const departments = ['All Departments', 'Media', 'Operational Management', 'Customer Service'];

const statusStyles = {
  'Not Started': 'bg-slate-50 text-slate-600 border-slate-200',
  'In Progress': 'bg-indigo-50 text-indigo-700 border-indigo-100',
  Completed: 'bg-emerald-50 text-emerald-700 border-emerald-100'
};

const formatNumber = (value) => new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 2
}).format(Number(value || 0));

const getProgress = (goal) => {
  const current = Number(goal.current_value || 0);
  const target = Number(goal.target_value || 0);
  if (target <= 0) return 0;
  return Math.min(100, Math.round((current / target) * 100));
};

const AdminGoals = () => {
  const [goals, setGoals] = useState([]);
  const [staffMembers, setStaffMembers] = useState([]);
  const [quickValues, setQuickValues] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGoalId, setEditingGoalId] = useState(null);
  const [goalDepartment, setGoalDepartment] = useState('All Departments');
  const [goalStaffId, setGoalStaffId] = useState('');
  const [newGoal, setNewGoal] = useState({
    title: '',
    goal_type: 'numeric',
    target_value: '',
    current_value: 0,
    status: 'Not Started'
  });
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const authHeaders = useCallback(() => ({
    Authorization: `Bearer ${localStorage.getItem('token')}`
  }), []);

  const fetchGoals = useCallback(async ({ showLoading = true } = {}) => {
    try {
      if (showLoading) setIsLoading(true);
      const res = await axios.get('/api/goals', { headers: authHeaders() });
      const fetchedGoals = Array.isArray(res.data) ? res.data : [];
      setGoals(fetchedGoals);
      setQuickValues(Object.fromEntries(fetchedGoals.map(goal => [goal.id, goal.current_value || 0])));
    } catch (err) {
      console.error('Failed to fetch goals:', err);
      setError('Unable to load goals.');
    } finally {
      setIsLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    const timer = window.setTimeout(() => fetchGoals({ showLoading: false }), 0);
    return () => window.clearTimeout(timer);
  }, [fetchGoals]);

  useEffect(() => {
    const fetchStaff = async () => {
      try {
        const res = await axios.get('/api/staff', { headers: authHeaders() });
        setStaffMembers((Array.isArray(res.data) ? res.data : []).filter(staff =>
          (staff.status || staff.staff_status) === 'Active' &&
          staff.department !== 'Logistics'
        ));
      } catch (err) {
        console.error('Failed to fetch staff for goals:', err);
      }
    };

    const timer = window.setTimeout(fetchStaff, 0);
    return () => window.clearTimeout(timer);
  }, [authHeaders]);

  const handleCreateGoal = async (event) => {
    event.preventDefault();
    if (!newGoal.title.trim()) return;

    const goalTitle = newGoal.title.trim();
    const goalType = newGoal.goal_type;
    const initialStatus = newGoal.status;
    const targetValue = newGoal.target_value;
    const currentValue = newGoal.current_value;

    const payload = {
      title: goalTitle,
      goal_type: goalType,
      status: goalType === 'milestone' ? initialStatus : 'Not Started',
      target_value: goalType === 'numeric' ? Number(targetValue) : null,
      current_value: goalType === 'numeric' ? Number(currentValue || 0) : null,
      department: goalDepartment,
      staff_id: goalStaffId || null
    };

    try {
      setIsSaving(true);
      setError('');
      const request = editingGoalId
        ? axios.put(`/api/goals/${editingGoalId}`, payload, { headers: authHeaders() })
        : axios.post('/api/goals', payload, { headers: authHeaders() });

      await request.catch(err => {
        console.error('Failed to create goal:', err);
        throw err;
      });
      setNewGoal({
        title: '',
        goal_type: 'numeric',
        target_value: '',
        current_value: 0,
        status: 'Not Started'
      });
      setGoalDepartment('All Departments');
      setGoalStaffId('');
      setEditingGoalId(null);
      setIsModalOpen(false);
      await fetchGoals();
    } catch (err) {
      console.error('Failed to create goal:', err);
      setError(err.response?.data?.message || 'Unable to create goal.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleQuickUpdate = async (goal) => {
    const nextValue = quickValues[goal.id];
    const previousGoals = goals;
    setGoals(prev => prev.map(item => (
      item.id === goal.id ? { ...item, current_value: nextValue } : item
    )));

    try {
      const res = await axios.put(`/api/goals/${goal.id}`, { current_value: nextValue }, { headers: authHeaders() });
      setGoals(prev => prev.map(item => (item.id === goal.id ? res.data : item)));
    } catch (err) {
      console.error('Failed to update goal:', err);
      setGoals(previousGoals);
      setError(err.response?.data?.message || 'Unable to update goal.');
    }
  };

  const handleStatusChange = async (goal, status) => {
    const previousGoals = goals;
    setGoals(prev => prev.map(item => (item.id === goal.id ? { ...item, status } : item)));

    try {
      const res = await axios.put(`/api/goals/${goal.id}`, { status }, { headers: authHeaders() });
      setGoals(prev => prev.map(item => (item.id === goal.id ? res.data : item)));
    } catch (err) {
      console.error('Failed to update milestone:', err);
      setGoals(previousGoals);
      setError(err.response?.data?.message || 'Unable to update milestone.');
    }
  };

  const handleDeleteGoal = async (goalId) => {
    const previousGoals = goals;
    setGoals(prev => prev.filter(goal => goal.id !== goalId));

    try {
      await axios.delete(`/api/goals/${goalId}`, { headers: authHeaders() });
    } catch (err) {
      console.error('Failed to delete goal:', err);
      setGoals(previousGoals);
      setError(err.response?.data?.message || 'Unable to delete goal.');
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingGoalId(null);
    setNewGoal({
      title: '',
      goal_type: 'numeric',
      target_value: '',
      current_value: 0,
      status: 'Not Started'
    });
    setGoalDepartment('All Departments');
    setGoalStaffId('');
  };

  const handleEditGoal = (goal) => {
    setEditingGoalId(goal.id);
    setNewGoal({
      title: goal.title || '',
      goal_type: goal.goal_type || 'numeric',
      target_value: goal.target_value ?? '',
      current_value: goal.current_value ?? 0,
      status: goal.status || 'Not Started'
    });
    setGoalDepartment(goal.department || 'All Departments');
    setGoalStaffId(goal.staff_id || '');
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6 bg-slate-50" dir="ltr">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-slate-400">Admin Workspace</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Agency Goals & Missions</h1>
          <p className="mt-2 text-sm font-semibold text-slate-500">Track both measurable numeric goals and mission milestones.</p>
        </div>
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-sm shadow-emerald-100 transition hover:bg-emerald-700"
        >
          <Plus size={18} />
          Add New Goal
        </button>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
          {error}
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-indigo-50 p-3 text-indigo-600">
              <Target size={22} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-950">Goals List</h2>
              <p className="text-sm font-medium text-slate-500">{goals.length} mission records</p>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center gap-3 p-12 text-sm font-bold text-slate-500">
            <Loader2 size={18} className="animate-spin" />
            Loading goals...
          </div>
        ) : goals.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50 text-slate-300">
              <Target size={30} />
            </div>
            <p className="mt-4 text-lg font-black text-slate-800">No goals yet</p>
            <p className="mt-1 text-sm font-semibold text-slate-500">Add the first agency goal to start tracking progress.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {goals.map(goal => {
              const isNumeric = goal.goal_type === 'numeric';
              const progress = getProgress(goal);

              return (
                <div key={goal.id} className="grid gap-5 px-6 py-5 lg:grid-cols-[1fr_260px_108px] lg:items-center">
                  <div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-base font-black text-slate-950">{goal.title}</p>
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">
                            {isNumeric ? 'Numeric' : 'Milestone'}
                          </span>
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-500">
                            {goal.department || 'All Departments'}
                          </span>
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${goal.staff_id ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700'}`}>
                            {goal.staff_id ? `Assigned to ${goal.staff_name || 'Staff'}` : 'Agency Wide'}
                          </span>
                        </div>
                        <p className="mt-1 text-xs font-semibold text-slate-400">
                          Created {new Date(goal.created_at).toLocaleDateString('en-US')}
                        </p>
                      </div>
                      {isNumeric ? (
                        <p className="text-sm font-black text-slate-700">
                          {formatNumber(goal.current_value)} / {formatNumber(goal.target_value)}
                        </p>
                      ) : (
                        <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusStyles[goal.status]}`}>
                          {goal.status}
                        </span>
                      )}
                    </div>

                    {isNumeric ? (
                      <div className="mt-4">
                        <div className="mb-2 flex items-center justify-between text-xs font-black text-slate-400">
                          <span>Progress</span>
                          <span>{progress}%</span>
                        </div>
                        <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-indigo-600" style={{ width: `${progress}%` }} />
                        </div>
                      </div>
                    ) : (
                      <p className="mt-4 text-sm font-semibold text-slate-500">
                        Update this mission through the milestone status dropdown.
                      </p>
                    )}
                  </div>

                  {isNumeric ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        value={quickValues[goal.id] ?? ''}
                        onChange={(event) => setQuickValues(prev => ({ ...prev, [goal.id]: event.target.value }))}
                        className="h-11 min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-700 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-50"
                        aria-label="Quick update current value"
                      />
                      <button
                        type="button"
                        onClick={() => handleQuickUpdate(goal)}
                        className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white transition hover:bg-blue-700"
                        aria-label="Save goal progress"
                      >
                        <Save size={17} />
                      </button>
                    </div>
                  ) : (
                    <select
                      value={goal.status}
                      onChange={(event) => handleStatusChange(goal, event.target.value)}
                      className={`h-11 rounded-xl border px-3 text-sm font-black outline-none transition focus:ring-4 focus:ring-blue-50 ${statusStyles[goal.status]}`}
                    >
                      {statuses.map(status => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  )}

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleEditGoal(goal)}
                      className="flex h-11 w-11 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-blue-600 transition hover:bg-blue-100"
                      aria-label="Edit goal"
                    >
                      <Pencil size={17} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteGoal(goal.id)}
                      className="flex h-11 w-11 items-center justify-center rounded-xl border border-rose-100 bg-rose-50 text-rose-600 transition hover:bg-rose-100"
                      aria-label="Delete goal"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4">
          <form onSubmit={handleCreateGoal} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-slate-950">{editingGoalId ? 'Edit Goal' : 'Add New Goal'}</h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">{editingGoalId ? 'Update this agency goal.' : 'Create a numeric target or a milestone mission.'}</p>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-700"
                aria-label="Close modal"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-bold text-slate-700">Goal Type</label>
                <select
                  value={newGoal.goal_type}
                  onChange={(event) => setNewGoal(prev => ({ ...prev, goal_type: event.target.value }))}
                  className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-50"
                >
                  <option value="numeric">Numeric Goal</option>
                  <option value="milestone">Milestone Goal</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-bold text-slate-700">Goal Title</label>
                <input
                  value={newGoal.title}
                  onChange={(event) => setNewGoal(prev => ({ ...prev, title: event.target.value }))}
                  className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-50"
                  placeholder="Enter mission title"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-bold text-slate-700">Assigned Department</label>
                <select
                  value={goalDepartment}
                  onChange={(event) => setGoalDepartment(event.target.value)}
                  className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-50"
                >
                  {departments.map(department => (
                    <option key={department} value={department}>{department}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-bold text-slate-700">Assign to Staff</label>
                <select
                  value={goalStaffId}
                  onChange={(event) => setGoalStaffId(event.target.value)}
                  className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-50"
                >
                  <option value="">Agency Wide</option>
                  {staffMembers.map(staff => (
                    <option key={staff.id} value={staff.id}>
                      {staff.full_name || staff.name} - {staff.job_title || staff.department}
                    </option>
                  ))}
                </select>
              </div>

              {newGoal.goal_type === 'numeric' ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-bold text-slate-700">Target Value</label>
                    <input
                      type="number"
                      min="1"
                      value={newGoal.target_value}
                      onChange={(event) => setNewGoal(prev => ({ ...prev, target_value: event.target.value }))}
                      className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-50"
                      placeholder="20000"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-bold text-slate-700">Current Value</label>
                    <input
                      type="number"
                      min="0"
                      value={newGoal.current_value}
                      onChange={(event) => setNewGoal(prev => ({ ...prev, current_value: event.target.value }))}
                      className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-50"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="mb-1 block text-sm font-bold text-slate-700">Initial Status</label>
                  <select
                    value={newGoal.status}
                    onChange={(event) => setNewGoal(prev => ({ ...prev, status: event.target.value }))}
                    className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-50"
                  >
                    {statuses.map(status => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={handleCloseModal}
                className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-black text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-black text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? 'Saving...' : editingGoalId ? 'Save Goal' : 'Create Goal'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default AdminGoals;
