import { useState } from 'react';
import axios from 'axios';
import { Briefcase, Loader2, User, X } from 'lucide-react';

const initialFormData = {
  full_name: '',
  gender: 'Male',
  phone: '',
  email: '',
  password: '',
  address: '',
  department: 'Customer Service',
  job_title: 'Customer Service Officer',
  staff_status: 'Active',
  monthly_salary: '',
  hire_date: ''
};

const jobTitlesByDepartment = {
  'Customer Service': ['Customer Service Officer'],
  Counselor: ['Junior Counselor', 'Senior Counselor'],
  Finance: ['Accountant'],
  Operations: ['Operations Officer']
};

const buildInitialFormData = (staffToEdit) => {
  if (!staffToEdit) return initialFormData;

  const rawDepartment = staffToEdit.department || initialFormData.department;
  const department = jobTitlesByDepartment[rawDepartment] ? rawDepartment : initialFormData.department;
  const validTitles = jobTitlesByDepartment[department];

  return {
    full_name: staffToEdit.full_name || staffToEdit.name || '',
    gender: staffToEdit.gender || 'Male',
    phone: staffToEdit.phone || '',
    email: staffToEdit.email || '',
    password: '',
    address: staffToEdit.address || '',
    department,
    job_title: validTitles.includes(staffToEdit.job_title) ? staffToEdit.job_title : validTitles[0],
    staff_status: staffToEdit.status || staffToEdit.staff_status || 'Active',
    monthly_salary: staffToEdit.monthly_salary || '',
    hire_date: staffToEdit.hireDate || staffToEdit.hire_date || ''
  };
};

const AddStaffModal = ({ isOpen, onClose, onSuccess, staffToEdit = null }) => {
  const [formData, setFormData] = useState(() => buildInitialFormData(staffToEdit));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const isEditMode = Boolean(staffToEdit?.id);

  if (!isOpen) return null;

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData(prev => {
      if (name === 'department') {
        return {
          ...prev,
          department: value,
          job_title: jobTitlesByDepartment[value][0]
        };
      }
      return { ...prev, [name]: value };
    });
  };

  const handleClose = () => {
    if (isSubmitting) return;
    setError('');
    setFormData(initialFormData);
    onClose();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const token = localStorage.getItem('token');
      const payload = isEditMode
        ? Object.fromEntries(Object.entries(formData).filter(([key]) => key !== 'password'))
        : formData;
      const res = isEditMode
        ? await axios.put(`/api/staff/${staffToEdit.id}`, payload, {
            headers: { Authorization: `Bearer ${token}` }
          })
        : await axios.post('/api/staff', payload, {
        headers: { Authorization: `Bearer ${token}` }
          });

      if (res.data.temporaryPassword) {
        alert(`Staff created. Temporary password: ${res.data.temporaryPassword}`);
      }

      setFormData(initialFormData);
      await onSuccess();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || `Failed to ${isEditMode ? 'update' : 'add'} staff member.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass = 'w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-800 outline-none transition-colors focus:border-agency-blue focus:bg-white focus:ring-2 focus:ring-blue-100';
  const labelClass = 'mb-1.5 block text-sm font-semibold text-gray-700';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-lg">
        <div className="flex items-start justify-between border-b border-gray-100 px-6 py-5">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{isEditMode ? 'Edit Staff' : 'Add New Staff'}</h2>
            <p className="mt-1 text-sm text-gray-500">{isEditMode ? 'Update employee details' : 'Enter new employee details'}</p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-full p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
            aria-label="Close add staff modal"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="space-y-8 overflow-y-auto px-6 py-6">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
                {error}
              </div>
            )}

            <section>
              <div className="mb-4 flex items-center gap-2">
                <div className="rounded-lg bg-blue-50 p-2 text-agency-blue">
                  <User size={18} />
                </div>
                <h3 className="text-base font-bold text-gray-900">Personal Information</h3>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className={labelClass} htmlFor="full_name">Full Name</label>
                  <input id="full_name" name="full_name" type="text" value={formData.full_name} onChange={handleChange} className={inputClass} required />
                </div>

                <div>
                  <label className={labelClass} htmlFor="gender">Gender</label>
                  <select id="gender" name="gender" value={formData.gender} onChange={handleChange} className={inputClass}>
                    <option>Male</option>
                    <option>Female</option>
                  </select>
                </div>

                <div>
                  <label className={labelClass} htmlFor="phone">Phone Number</label>
                  <input id="phone" name="phone" type="text" value={formData.phone} onChange={handleChange} className={inputClass} />
                </div>

                <div>
                  <label className={labelClass} htmlFor="email">Email Address</label>
                  <input id="email" name="email" type="email" value={formData.email} onChange={handleChange} className={inputClass} required />
                </div>

                {!isEditMode && (
                <div>
                  <label className={labelClass} htmlFor="password">Password</label>
                  <input id="password" name="password" type="password" value={formData.password} onChange={handleChange} className={inputClass} required minLength={8} />
                </div>
                )}

                <div>
                  <label className={labelClass} htmlFor="address">Address</label>
                  <input id="address" name="address" type="text" value={formData.address} onChange={handleChange} className={inputClass} />
                </div>
              </div>
            </section>

            <section>
              <div className="mb-4 flex items-center gap-2">
                <div className="rounded-lg bg-blue-50 p-2 text-agency-blue">
                  <Briefcase size={18} />
                </div>
                <h3 className="text-base font-bold text-gray-900">Job Information</h3>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className={labelClass} htmlFor="department">Department</label>
                  <select id="department" name="department" value={formData.department} onChange={handleChange} className={inputClass}>
                    {Object.keys(jobTitlesByDepartment).map(department => (
                      <option key={department}>{department}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={labelClass} htmlFor="job_title">Job Title</label>
                  <select id="job_title" name="job_title" value={formData.job_title} onChange={handleChange} className={inputClass}>
                    {jobTitlesByDepartment[formData.department].map(title => (
                      <option key={title}>{title}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={labelClass} htmlFor="staff_status">Employee Status</label>
                  <select id="staff_status" name="staff_status" value={formData.staff_status} onChange={handleChange} className={inputClass}>
                    <option>Active</option>
                    <option>On Leave</option>
                    <option>Probation</option>
                    <option>New</option>
                  </select>
                </div>

                <div>
                  <label className={labelClass} htmlFor="monthly_salary">Monthly Salary (USD/MYR)</label>
                  <input id="monthly_salary" name="monthly_salary" type="number" min="0" step="0.01" value={formData.monthly_salary} onChange={handleChange} className={inputClass} />
                </div>

                <div>
                  <label className={labelClass} htmlFor="hire_date">Date of Hire</label>
                  <input id="hire_date" name="hire_date" type="date" value={formData.hire_date} onChange={handleChange} className={inputClass} />
                </div>
              </div>
            </section>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-gray-100 bg-gray-50 px-6 py-4">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="rounded-lg bg-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-300 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-lg bg-agency-blue px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-agency-lightBlue disabled:opacity-60"
            >
              {isSubmitting && <Loader2 size={16} className="animate-spin" />}
              {isSubmitting ? (isEditMode ? 'Saving...' : 'Adding...') : (isEditMode ? 'Save Changes' : 'Add Employee')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddStaffModal;
