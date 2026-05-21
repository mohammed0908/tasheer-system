import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { GraduationCap, Loader2, UploadCloud, User, Users, X } from 'lucide-react';
import ClientDocumentsGrid from './ClientDocumentsGrid';

const emptyFormData = {
  name: '',
  email: '',
  phone: '',
  passport_no: '',
  nationality: '',
  guardian_name: '',
  guardian_phone: '',
  guardian_email: '',
  university_name: '',
  program_name: '',
  qualification: '',
  study_location: '',
  study_duration_months: ''
};

const EditClientModal = ({ clientData, isOpen, onClose, onSuccess }) => {
  const [formData, setFormData] = useState(() => (
    clientData
      ? {
          name: clientData.name || '',
          email: clientData.email || '',
          phone: clientData.phone || '',
          passport_no: clientData.passport_no || '',
          nationality: clientData.nationality || '',
          guardian_name: clientData.guardian_name || '',
          guardian_phone: clientData.guardian_phone || '',
          guardian_email: clientData.guardian_email || '',
          university_name: clientData.university_name || '',
          program_name: clientData.program_name || '',
          qualification: clientData.qualification || '',
          study_location: clientData.study_location || '',
          study_duration_months: clientData.study_duration_months || ''
        }
      : emptyFormData
  ));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const fetchDocuments = async () => {
    try {
      setIsLoadingDocuments(true);
      const token = localStorage.getItem('token');
      const res = await axios.get(`/api/clients/${clientData.id}/documents`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDocuments(res.data);
    } catch (err) {
      console.error('Error fetching client documents:', err);
      setDocuments([]);
    } finally {
      setIsLoadingDocuments(false);
    }
  };

  useEffect(() => {
    const fetchInitialDocuments = async () => {
      try {
        setIsLoadingDocuments(true);
        const token = localStorage.getItem('token');
        const res = await axios.get(`/api/clients/${clientData.id}/documents`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setDocuments(res.data);
      } catch (err) {
        console.error('Error fetching client documents:', err);
        setDocuments([]);
      } finally {
        setIsLoadingDocuments(false);
      }
    };

    fetchInitialDocuments();
  }, [clientData.id]);

  if (!isOpen || !clientData) return null;

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      await axios.put(`/api/clients/${clientData.id}`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      await onSuccess();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update client.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDocumentUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!clientData.application_id) {
      setError('This client has no application to attach documents to.');
      return;
    }

    setIsUploading(true);
    setError('');

    try {
      const data = new FormData();
      data.append('document', file);
      data.append('application_id', clientData.application_id);
      data.append('document_type', file.name.replace(/\.[^/.]+$/, '') || 'Staff Upload');

      const token = localStorage.getItem('token');
      await axios.post('/api/documents', data, {
        headers: { Authorization: `Bearer ${token}` }
      });

      await fetchDocuments();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to upload document.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const inputClass = 'w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-800 outline-none transition-colors focus:border-agency-blue focus:bg-white focus:ring-2 focus:ring-blue-100';
  const labelClass = 'mb-1.5 block text-sm font-semibold text-gray-700';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-lg">
        <div className="flex items-start justify-between border-b border-gray-100 px-6 py-5">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Edit Client</h2>
            <p className="mt-1 text-sm text-gray-500">Update client profile and identity details</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700" aria-label="Close edit client modal">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="space-y-6 overflow-y-auto px-6 py-6">
            {error && (
              <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
                {error}
              </div>
            )}

            <div className="mb-4 flex items-center gap-2">
              <div className="rounded-lg bg-blue-50 p-2 text-agency-blue">
                <User size={18} />
              </div>
              <h3 className="text-base font-bold text-gray-900">Client Information</h3>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="client_name">Full Name</label>
                <input id="client_name" name="name" type="text" value={formData.name} onChange={handleChange} className={inputClass} required />
              </div>

              <div>
                <label className={labelClass} htmlFor="client_email">Email</label>
                <input id="client_email" name="email" type="email" value={formData.email} onChange={handleChange} className={inputClass} required />
              </div>

              <div>
                <label className={labelClass} htmlFor="client_phone">Phone</label>
                <input id="client_phone" name="phone" type="text" value={formData.phone} onChange={handleChange} className={inputClass} />
              </div>

              <div>
                <label className={labelClass} htmlFor="client_passport">Passport Number</label>
                <input id="client_passport" name="passport_no" type="text" value={formData.passport_no} onChange={handleChange} className={inputClass} />
              </div>

              <div>
                <label className={labelClass} htmlFor="client_nationality">Nationality</label>
                <input id="client_nationality" name="nationality" type="text" value={formData.nationality} onChange={handleChange} className={inputClass} />
              </div>
            </div>

            <div className="border-t border-gray-100 pt-6">
              <div className="mb-4 flex items-center gap-2">
                <div className="rounded-lg bg-blue-50 p-2 text-agency-blue">
                  <Users size={18} />
                </div>
                <h3 className="text-base font-bold text-gray-900">Guardian Information</h3>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className={labelClass} htmlFor="guardian_name">Guardian Name</label>
                  <input id="guardian_name" name="guardian_name" type="text" value={formData.guardian_name} onChange={handleChange} className={inputClass} />
                </div>

                <div>
                  <label className={labelClass} htmlFor="guardian_phone">Guardian Phone</label>
                  <input id="guardian_phone" name="guardian_phone" type="text" value={formData.guardian_phone} onChange={handleChange} className={inputClass} />
                </div>

                <div>
                  <label className={labelClass} htmlFor="guardian_email">Guardian Email</label>
                  <input id="guardian_email" name="guardian_email" type="email" value={formData.guardian_email} onChange={handleChange} className={inputClass} />
                </div>
              </div>
            </div>

            <div className="border-t border-gray-100 pt-6">
              <div className="mb-4 flex items-center gap-2">
                <div className="rounded-lg bg-blue-50 p-2 text-agency-blue">
                  <GraduationCap size={18} />
                </div>
                <h3 className="text-base font-bold text-gray-900">Academic Information</h3>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className={labelClass} htmlFor="university_name">University</label>
                  <input id="university_name" name="university_name" type="text" value={formData.university_name} onChange={handleChange} className={inputClass} />
                </div>

                <div>
                  <label className={labelClass} htmlFor="program_name">Program</label>
                  <input id="program_name" name="program_name" type="text" value={formData.program_name} onChange={handleChange} className={inputClass} />
                </div>

                <div>
                  <label className={labelClass} htmlFor="qualification">Qualification</label>
                  <input id="qualification" name="qualification" type="text" value={formData.qualification} onChange={handleChange} className={inputClass} />
                </div>

                <div>
                  <label className={labelClass} htmlFor="study_location">Location</label>
                  <input id="study_location" name="study_location" type="text" value={formData.study_location} onChange={handleChange} className={inputClass} />
                </div>

                <div>
                  <label className={labelClass} htmlFor="study_duration_months">Duration</label>
                  <input id="study_duration_months" name="study_duration_months" type="number" min="0" value={formData.study_duration_months} onChange={handleChange} className={inputClass} />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-gray-100 pt-6">
              <div>
                <p className="text-sm font-bold text-gray-900">Attach a Missing Document</p>
                <p className="mt-1 text-xs text-gray-500">Uploads are saved to this client's current application.</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                onChange={handleDocumentUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading || !clientData.application_id}
                className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-agency-blue shadow-sm ring-1 ring-blue-100 transition-colors hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isUploading ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
                {isUploading ? 'Uploading...' : 'Upload New Document'}
              </button>
            </div>

            <ClientDocumentsGrid documents={documents} isLoading={isLoadingDocuments} />
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-gray-100 bg-gray-50 px-6 py-4">
            <button type="button" onClick={onClose} disabled={isSubmitting} className="rounded-lg bg-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-300 disabled:opacity-60">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className="inline-flex items-center gap-2 rounded-lg bg-agency-blue px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-agency-lightBlue disabled:opacity-60">
              {isSubmitting && <Loader2 size={16} className="animate-spin" />}
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditClientModal;
