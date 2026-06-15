import { useEffect, useState } from 'react';
import axios from 'axios';
import {
  CheckCircle,
  FileText,
  GraduationCap,
  Loader2,
  UploadCloud,
  User,
  Users,
  X
} from 'lucide-react';

const initialFormData = {
  full_name: '',
  nationality: '',
  passport_number: '',
  phone: '',
  email: '',
  country_of_residence: '',
  city: '',
  university_name: '',
  study_program: '',
  qualification: '',
  study_location: '',
  duration_months: '',
  visa_type: 'Student Visa',
  guardian_name: '',
  guardian_phone: '',
  guardian_email: '',
  counselor_id: ''
};

const initialFiles = {
  photo: null,
  certificate: null,
  passport: null,
  other: null
};

const steps = [
  { id: 1, label: 'Personal Info', icon: User },
  { id: 2, label: 'Academic Info', icon: GraduationCap },
  { id: 3, label: 'Guardian Info', icon: Users },
  { id: 4, label: 'Documents', icon: FileText },
  { id: 5, label: 'Review & Submit', icon: CheckCircle }
];

const documentLabels = {
  photo: 'Personal Photo',
  certificate: 'Academic Certificate',
  passport: 'Passport Copy',
  other: 'Other Documents'
};

const inputClass = 'h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50';
const labelClass = 'mb-2 block text-sm font-black text-slate-700';

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

const getApiErrorMessage = (err, fallback = 'Failed to submit application.') => (
  err.response?.data?.error ||
  err.response?.data?.message ||
  err.message ||
  fallback
);

const CreateApplicationModal = ({ isOpen, onClose, onSuccess, mode }) => {
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const currentDepartment = normalizeDepartment(currentUser);
  const isClientMode = mode === 'client' || currentUser.role === 'client';
  const isCounselorCreator = currentDepartment === 'Counselor';
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState(() => ({
    ...initialFormData,
    full_name: isClientMode ? currentUser.full_name || currentUser.name || '' : '',
    email: isClientMode ? currentUser.email || '' : ''
  }));
  const [files, setFiles] = useState(initialFiles);
  const [isAgreed, setIsAgreed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [counselors, setCounselors] = useState([]);

  useEffect(() => {
    if (!isOpen) return undefined;
    if (isClientMode || isCounselorCreator) {
      return undefined;
    }

    const timer = window.setTimeout(async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get('/api/staff?department=Counselor', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setCounselors(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error('Failed to fetch counselors:', err);
        setCounselors([]);
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, [isClientMode, isCounselorCreator, isOpen]);

  if (!isOpen) return null;

  const resetModal = () => {
    setCurrentStep(1);
    setFormData({
      ...initialFormData,
      full_name: isClientMode ? currentUser.full_name || currentUser.name || '' : '',
      email: isClientMode ? currentUser.email || '' : ''
    });
    setFiles(initialFiles);
    setIsAgreed(false);
    setError('');
  };

  const handleClose = () => {
    if (isSubmitting) return;
    resetModal();
    onClose();
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (key, event) => {
    const file = event.target.files?.[0] || null;
    setFiles(prev => ({ ...prev, [key]: file }));
    event.target.value = '';
  };

  const uploadDocuments = async (applicationId, token) => {
    const uploadJobs = Object.entries(files)
      .filter(([, file]) => Boolean(file))
      .map(([documentType, file]) => {
        const uploadData = new FormData();
        uploadData.append('document', file);
        uploadData.append('application_id', applicationId);
        uploadData.append('document_type', documentType);
        uploadData.append('uploaded_by_role', isClientMode ? 'client' : 'staff');

        const uploadUrl = isClientMode ? `/api/applications/${applicationId}/documents` : '/api/documents';

        return axios.post(uploadUrl, uploadData, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        });
      });

    await Promise.all(uploadJobs);
  };

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      setError('');
      const token = localStorage.getItem('token');
      const endpoint = isClientMode ? '/api/applications/client-create' : '/api/applications';
      const response = await axios.post(endpoint, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const applicationId = response.data.application_id || response.data.applicationId;

      if (!applicationId) {
        throw new Error('Application was created, but no application ID was returned.');
      }

      await uploadDocuments(applicationId, token);
      await onSuccess?.();
      resetModal();
      onClose();
      window.alert(isClientMode ? 'Application submitted for review.' : 'Application submitted successfully.');
    } catch (err) {
      console.error('Failed to submit application:', err);
      setError(getApiErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderTextInput = ({ label, name, type = 'text', className = '' }) => (
    <div className={className}>
      <label className={labelClass} htmlFor={name}>{label}</label>
      <input
        id={name}
        name={name}
        type={type}
        value={formData[name]}
        onChange={handleChange}
        className={inputClass}
      />
    </div>
  );

  const renderDropzone = ({ keyName, label, hint }) => (
    <label className="cursor-pointer rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-center transition hover:bg-slate-100">
      <input
        type="file"
        accept=".pdf,.jpg,.png,.jpeg"
        className="hidden"
        onChange={(event) => handleFileChange(keyName, event)}
      />
      <UploadCloud className="mx-auto h-8 w-8 text-slate-400" />
      <p className="mt-3 text-sm font-black text-slate-800">{label}</p>
      <p className="mt-1 text-xs font-bold text-slate-400">{files[keyName]?.name || hint}</p>
    </label>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-6" dir="ltr">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="border-b border-slate-100 px-6 pt-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-xl font-black text-slate-950">Start New Application</h2>
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-blue-700">
                  {isClientMode ? 'Student' : 'Counselor'}
                </span>
              </div>
              <p className="mt-1 text-sm font-medium text-slate-500">Fill in all required data</p>
            </div>
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
              aria-label="Close modal"
            >
              <X size={20} />
            </button>
          </div>

          <div className="mt-5 flex gap-5 overflow-x-auto">
            {steps.map(step => {
              const Icon = step.icon;
              const isActive = currentStep === step.id;
              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => setCurrentStep(step.id)}
                  className={`flex shrink-0 items-center gap-2 border-b-2 px-1 pb-4 text-sm font-black transition ${
                    isActive
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-400 hover:text-slate-700'
                  }`}
                >
                  <Icon size={17} />
                  {step.id}: {step.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          {error && (
            <div className="mb-5 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
              {error}
            </div>
          )}

          {currentStep === 1 && (
            <section>
              <h3 className="mb-5 text-sm font-black uppercase tracking-[0.16em] text-slate-400">Personal Info</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {renderTextInput({ label: 'Full Name', name: 'full_name', className: 'md:col-span-2' })}
                {renderTextInput({ label: 'Nationality', name: 'nationality' })}
                {renderTextInput({ label: 'Passport Number', name: 'passport_number' })}
                {renderTextInput({ label: 'Phone', name: 'phone' })}
                {renderTextInput({ label: 'Email', name: 'email', type: 'email' })}
                {renderTextInput({ label: 'Country of Residence', name: 'country_of_residence' })}
                {renderTextInput({ label: 'City', name: 'city' })}
              </div>
            </section>
          )}

          {currentStep === 2 && (
            <section>
              <h3 className="mb-5 text-sm font-black uppercase tracking-[0.16em] text-slate-400">Academic Info</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {renderTextInput({ label: 'University Name', name: 'university_name' })}
                {renderTextInput({ label: 'Study Program', name: 'study_program' })}
                {renderTextInput({ label: 'Qualification', name: 'qualification' })}
                {renderTextInput({ label: 'Study Location', name: 'study_location' })}
                {isClientMode && (
                  <div>
                    <label className={labelClass} htmlFor="visa_type">Visa Type</label>
                    <select
                      id="visa_type"
                      name="visa_type"
                      value={formData.visa_type}
                      onChange={handleChange}
                      className={inputClass}
                      required
                    >
                      <option value="Student Visa">Student Visa</option>
                      <option value="Visit Visa">Visit Visa</option>
                      <option value="Dependent Visa">Dependent Visa</option>
                    </select>
                  </div>
                )}
                {renderTextInput({ label: 'Duration (Months)', name: 'duration_months', type: 'number' })}
                {!isClientMode && !isCounselorCreator && (
                  <div>
                    <label className={labelClass} htmlFor="counselor_id">Assign to Counselor</label>
                    <select
                      id="counselor_id"
                      name="counselor_id"
                      value={formData.counselor_id}
                      onChange={handleChange}
                      className={inputClass}
                      required
                    >
                      <option value="">Select counselor</option>
                      {counselors.map(counselor => (
                        <option key={counselor.id} value={counselor.id}>{counselor.full_name}</option>
                      ))}
                    </select>
                  </div>
                )}
                {!isClientMode && isCounselorCreator && (
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-600">Assigned Counselor</p>
                    <p className="mt-1 text-sm font-black text-emerald-900">{currentUser.full_name || 'You'}</p>
                    <p className="mt-1 text-xs font-semibold text-emerald-700">This application will be assigned to you automatically.</p>
                  </div>
                )}
              </div>
            </section>
          )}

          {currentStep === 3 && (
            <section>
              <h3 className="mb-5 text-sm font-black uppercase tracking-[0.16em] text-slate-400">Guardian Info</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {renderTextInput({ label: 'Guardian Name', name: 'guardian_name' })}
                {renderTextInput({ label: 'Guardian Phone', name: 'guardian_phone' })}
                {renderTextInput({ label: 'Guardian Email', name: 'guardian_email', type: 'email', className: 'md:col-span-2' })}
              </div>
            </section>
          )}

          {currentStep === 4 && (
            <section>
              <h3 className="mb-5 text-sm font-black uppercase tracking-[0.16em] text-slate-400">Documents</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {renderDropzone({ keyName: 'photo', label: 'Personal Photo', hint: 'Max 2MB' })}
                {renderDropzone({ keyName: 'certificate', label: 'Academic Certificate', hint: 'Max 5MB' })}
                {renderDropzone({ keyName: 'passport', label: 'Passport Copy', hint: 'Max 2MB' })}
                {renderDropzone({ keyName: 'other', label: 'Other Documents', hint: 'Max 5MB' })}
              </div>
            </section>
          )}

          {currentStep === 5 && (
            <section className="space-y-5">
              <h3 className="text-sm font-black uppercase tracking-[0.16em] text-slate-400">Review & Submit</h3>
              <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-4">
                <input
                  type="checkbox"
                  checked={isAgreed}
                  onChange={(event) => setIsAgreed(event.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span>
                  <span className="block font-black text-slate-900">Terms & Conditions Agreement</span>
                  <span className="mt-1 block text-sm font-semibold text-slate-600">I confirm all provided data is correct.</span>
                </span>
              </label>

              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5">
                <h4 className="mb-4 text-sm font-black text-slate-800">Uploaded Documents Summary</h4>
                <div className="space-y-2">
                  {Object.entries(files).map(([key, file]) => (
                    <div key={key} className="flex items-center justify-between rounded-xl bg-white px-4 py-3 text-sm shadow-sm">
                      <span className="font-black text-slate-700">{documentLabels[key]}</span>
                      <span className={`font-bold ${file ? 'text-emerald-600' : 'text-slate-400'}`}>
                        {file ? file.name : 'Not uploaded'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 bg-white px-6 py-5">
          <div>
            {currentStep > 1 && (
              <button
                type="button"
                onClick={() => setCurrentStep(prev => Math.max(prev - 1, 1))}
                disabled={isSubmitting}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
              >
                Previous
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm font-black text-slate-600 transition hover:bg-slate-200 disabled:opacity-60"
            >
              Cancel
            </button>

            {currentStep < 5 ? (
              <button
                type="button"
                onClick={() => setCurrentStep(prev => Math.min(prev + 1, 5))}
                className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-black text-white shadow-sm shadow-blue-100 transition hover:bg-blue-700"
              >
                Next
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!isAgreed || isSubmitting}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-black text-white shadow-sm shadow-emerald-100 transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting && <Loader2 size={16} className="animate-spin" />}
                {isSubmitting ? 'Submitting...' : 'Submit Application'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateApplicationModal;
