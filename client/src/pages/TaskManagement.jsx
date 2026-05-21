import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { CheckSquare, Search, Plus, Edit2, Trash2, Save, X } from 'lucide-react';
import CreateTaskModal from '../components/CreateTaskModal';

const TaskManagement = () => {
  const [tasks, setTasks] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [staffFilter, setStaffFilter] = useState('All');
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    assigned_to: '',
    due_date: '',
    priority: 'Medium',
    status: 'pending'
  });

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/tasks', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTasks(res.data);
      setError(null);
    } catch (err) {
      console.error('Error fetching tasks:', err);
      setError('Failed to load tasks. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchInitialTasks = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('token');
        const res = await axios.get('/api/tasks', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setTasks(res.data);
        setError(null);
      } catch (err) {
        console.error('Error fetching tasks:', err);
        setError('Failed to load tasks. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    const fetchInitialStaff = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get('/api/staff', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setStaff(res.data);
      } catch (err) {
        console.error('Error fetching staff:', err);
      }
    };

    fetchInitialTasks();
    fetchInitialStaff();
  }, []);

  const getStatusLabel = (status) => {
    switch (status) {
      case 'completed':
      case 'Done':
        return 'Done';
      case 'in-progress':
      case 'In Progress':
        return 'In Progress';
      case 'waiting':
      case 'Waiting for Confirmation':
        return 'Waiting for Confirmation';
      case 'need-help':
      case 'Need Help':
        return 'Need Help';
      case 'pending':
      default:
        return 'Pending';
    }
  };

  const getStatusBadge = (status) => {
    const label = getStatusLabel(status);
    switch (label) {
      case 'Done':
        return <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border border-green-200">Done</span>;
      case 'Waiting for Confirmation':
        return <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border border-yellow-200">Waiting for Confirmation</span>;
      case 'Need Help':
        return <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border border-red-200">Need Help</span>;
      case 'In Progress':
        return <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border border-blue-200">In Progress</span>;
      case 'Pending':
      default:
        return <span className="bg-gray-100 text-gray-800 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border border-gray-200">Pending</span>;
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'No due date';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const startEditing = (task) => {
    setEditingTaskId(task.task_id);
    setEditForm({
      title: task.task_title || '',
      description: task.description || '',
      assigned_to: task.assigned_to || '',
      due_date: task.due_date ? task.due_date.slice(0, 10) : '',
      priority: task.priority || 'Medium',
      status: task.task_status || 'pending'
    });
  };

  const handleEditChange = (event) => {
    const { name, value } = event.target;
    setEditForm(prev => ({ ...prev, [name]: value }));
  };

  const saveTask = async (taskId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`/api/tasks/${taskId}`, editForm, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEditingTaskId(null);
      await fetchTasks();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update task.');
    }
  };

  const deleteTask = async (taskId) => {
    if (!window.confirm('Delete this task? This action cannot be undone.')) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`/api/tasks/${taskId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTasks(prev => prev.filter(task => task.task_id !== taskId));
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete task.');
    }
  };

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = (task.task_title || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'All' || getStatusLabel(task.task_status) === statusFilter;
    const matchesStaff = staffFilter === 'All' || String(task.assigned_to) === staffFilter;
    return matchesSearch && matchesStatus && matchesStaff;
  });

  const inputClass = 'rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 outline-none focus:border-agency-blue focus:bg-white focus:ring-2 focus:ring-blue-100';

  const getPriorityBadge = (priority) => {
    switch (priority) {
      case 'High':
        return <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700">High</span>;
      case 'Low':
        return <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-600">Low</span>;
      case 'Medium':
      case 'in-progress':
      default:
        return <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700">Medium</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 tracking-tight">Task Management</h1>
          <p className="text-gray-500 text-sm mt-1">Track and manage staff assignments and their progress.</p>
        </div>
        <button onClick={() => setIsCreateModalOpen(true)} className="flex items-center space-x-2 bg-agency-blue hover:bg-agency-lightBlue text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-sm transition-colors">
          <Plus size={16} />
          <span>New Task</span>
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-500 p-4 rounded-lg text-sm border border-red-200">
          {error}
        </div>
      )}

      {/* Action Toolbar */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="relative w-full max-w-md">
           <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
           </div>
           <input 
             type="text" 
             placeholder="Search tasks..." 
             value={searchQuery}
             onChange={(e) => setSearchQuery(e.target.value)}
             className="bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-lg focus:ring-agency-blue block w-full pl-10 p-2.5 outline-none transition-all"
           />
        </div>
        <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-lg focus:ring-agency-blue block w-full md:w-56 p-2.5 outline-none font-medium appearance-none">
            <option>All</option>
            <option>Pending</option>
            <option>In Progress</option>
            <option>Done</option>
            <option>Waiting for Confirmation</option>
            <option>Need Help</option>
          </select>
          <select value={staffFilter} onChange={(e) => setStaffFilter(e.target.value)} className="bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-lg focus:ring-agency-blue block w-full md:w-56 p-2.5 outline-none font-medium appearance-none">
            <option value="All">All Staff</option>
            {staff.map(member => <option key={member.id} value={member.id}>{member.full_name}</option>)}
          </select>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto p-4 min-h-[500px]">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-100 text-gray-600 uppercase text-xs font-semibold">
              <tr>
                <th className="px-5 py-4 rounded-l-lg">Task Title</th>
                <th className="px-5 py-4">Assigned Staff</th>
                <th className="px-5 py-4">Priority</th>
                <th className="px-5 py-4">Due Date</th>
                <th className="px-5 py-4 text-center">Status</th>
                <th className="px-5 py-4 text-right rounded-r-lg">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 border-t border-gray-100">
              {loading ? (
                <tr>
                  <td colSpan="6" className="text-center py-8 text-gray-500">Loading tasks...</td>
                </tr>
              ) : filteredTasks.length > 0 ? (
                filteredTasks.map((task) => (
                  <tr key={task.task_id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="px-5 py-4">
                      {editingTaskId === task.task_id ? (
                        <div className="space-y-2">
                          <input name="title" value={editForm.title} onChange={handleEditChange} className={`${inputClass} w-64`} />
                          <input name="description" value={editForm.description} onChange={handleEditChange} className={`${inputClass} w-80`} />
                        </div>
                      ) : (
                        <>
                          <span className="font-bold text-gray-900">{task.task_title}</span>
                          {task.description && <p className="mt-1 max-w-xs truncate text-xs text-gray-500">{task.description}</p>}
                        </>
                      )}
                    </td>
                    <td className="px-5 py-4 text-gray-700">
                      {editingTaskId === task.task_id ? (
                        <select name="assigned_to" value={editForm.assigned_to} onChange={handleEditChange} className={inputClass}>
                          {staff.map(member => <option key={member.id} value={member.id}>{member.full_name}</option>)}
                        </select>
                      ) : (
                        task.assigned_staff_name || task.assigned_staff || <span className="text-gray-400 italic">Unassigned</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {editingTaskId === task.task_id ? (
                        <select name="priority" value={editForm.priority} onChange={handleEditChange} className={inputClass}>
                          <option>Low</option>
                          <option>Medium</option>
                          <option>High</option>
                        </select>
                      ) : getPriorityBadge(task.priority)}
                    </td>
                    <td className="px-5 py-4 text-gray-700 font-mono">
                      {editingTaskId === task.task_id ? (
                        <input name="due_date" type="date" value={editForm.due_date} onChange={handleEditChange} className={inputClass} />
                      ) : formatDate(task.due_date)}
                    </td>
                    <td className="px-5 py-4 text-center">
                      {editingTaskId === task.task_id ? (
                        <select name="status" value={editForm.status} onChange={handleEditChange} className={inputClass}>
                          <option value="pending">Pending</option>
                          <option value="in-progress">In Progress</option>
                          <option value="completed">Done</option>
                        </select>
                      ) : getStatusBadge(task.task_status)}
                    </td>
                    <td className="px-5 py-4 text-right">
                      {editingTaskId === task.task_id ? (
                        <div className="flex justify-end gap-2">
                          <button onClick={() => saveTask(task.task_id)} className="p-1.5 text-green-600 hover:bg-green-50 rounded" title="Save"><Save size={18} /></button>
                          <button onClick={() => setEditingTaskId(null)} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded" title="Cancel"><X size={18} /></button>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-2">
                          <button onClick={() => startEditing(task)} className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors" title="Edit Task"><Edit2 size={18} /></button>
                          <button onClick={() => deleteTask(task.task_id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Delete Task"><Trash2 size={18} /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="text-center py-12">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <CheckSquare className="w-12 h-12 text-gray-300" />
                      <p className="text-gray-500 font-medium text-lg">No tasks assigned yet.</p>
                      <p className="text-gray-400 text-sm">Create a new task to assign work to your staff members.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <CreateTaskModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={fetchTasks}
      />
    </div>
  );
};

export default TaskManagement;
