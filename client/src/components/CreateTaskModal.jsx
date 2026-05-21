import { useEffect, useState } from 'react';
import axios from 'axios';
import { CheckSquare, Loader2, X } from 'lucide-react';

const initialFormData = {
  title: '',
  description: '',
  assigned_to: '',
  due_date: '',
  priority: 'Medium'
};

const CreateTaskModal = ({ isOpen, onClose, onSuccess }) => {
  const [formData, setFormData] = useState(initialFormData);
  const [staff, setStaff] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingStaff, setIsLoadingStaff] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    const fetchStaff = async () => {
      try {
        setIsLoadingStaff(true);
        const token = localStorage.getItem('token');
        const res = await axios.get('/api/staff', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setStaff(res.data);
      } catch (err) {
        console.error('Error fetching staff:', err);
        setError('Failed to load staff list.');
      } finally {
        setIsLoadingStaff(false);
      }
    };

    fetchStaff();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleClose = () => {
    if (isSubmitting) return;
    setFormData(initialFormData);
    setError('');
    onClose();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      await axios.post('/api/tasks', formData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      alert('Task created and staff notified.');
      setFormData(initialFormData);
      await onSuccess();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create task.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass = 'w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-800 outline-none transition-colors focus:border-agency-blue focus:bg-white focus:ring-2 focus:ring-blue-100';
  const labelClass = 'mb-1.5 block text-sm font-semibold text-gray-700';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-lg">
        <div className="flex items-start justify-between border-b border-gray-100 px-6 py-5">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Create New Task</h2>
            <p className="mt-1 text-sm text-gray-500">Assign work and notify the selected staff member</p>
          </div>
          <button type="button" onClick={handleClose} className="rounded-full p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700" aria-label="Close create task modal">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="space-y-5 overflow-y-auto px-6 py-6">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
                {error}
              </div>
            )}

            <div className="mb-1 flex items-center gap-2">
              <div className="rounded-lg bg-blue-50 p-2 text-agency-blue">
                <CheckSquare size={18} />
              </div>
              <h3 className="text-base font-bold text-gray-900">Task Details</h3>
            </div>

            <div>
              <label className={labelClass} htmlFor="task_title">Task Title</label>
              <input id="task_title" name="title" type="text" value={formData.title} onChange={handleChange} className={inputClass} required />
            </div>

            <div>
              <label className={labelClass} htmlFor="task_description">Description</label>
              <textarea id="task_description" name="description" rows="4" value={formData.description} onChange={handleChange} className={inputClass} />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="assigned_to">Assign To</label>
                <select id="assigned_to" name="assigned_to" value={formData.assigned_to} onChange={handleChange} className={inputClass} required>
                  <option value="">{isLoadingStaff ? 'Loading staff...' : 'Select staff member'}</option>
                  {staff.map(member => (
                    <option key={member.id} value={member.id}>{member.full_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass} htmlFor="due_date">Due Date</label>
                <input id="due_date" name="due_date" type="date" value={formData.due_date} onChange={handleChange} className={inputClass} />
              </div>

              <div>
                <label className={labelClass} htmlFor="priority">Priority</label>
                <select id="priority" name="priority" value={formData.priority} onChange={handleChange} className={inputClass}>
                  <option>Low</option>
                  <option>Medium</option>
                  <option>High</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-gray-100 bg-gray-50 px-6 py-4">
            <button type="button" onClick={handleClose} disabled={isSubmitting} className="rounded-lg bg-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-300 disabled:opacity-60">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className="inline-flex items-center gap-2 rounded-lg bg-agency-blue px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-agency-lightBlue disabled:opacity-60">
              {isSubmitting && <Loader2 size={16} className="animate-spin" />}
              {isSubmitting ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateTaskModal;
