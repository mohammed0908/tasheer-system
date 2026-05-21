import React, { useState } from 'react';
import axios from 'axios';
import { X, UploadCloud, FileText, CheckCircle } from 'lucide-react';

const getApiErrorMessage = (err, fallback = 'Failed to submit application.') => (
  err.response?.data?.error ||
  err.response?.data?.message ||
  err.message ||
  fallback
);

const NewApplicationModal = ({ isOpen, onClose, onComplete }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    nationality: '',
    passportNo: '',
    phone: '',
    email: '',
    country: '',
    city: '',
    universityName: '',
    studyProgram: '',
    studyLocation: '',
    qualification: '',
    studyDuration: '',
    guardianName: '',
    guardianPhone: '',
    guardianEmail: '',
    agreedToTerms: false
  });

  const [files, setFiles] = useState({
    studyCertificate: null,
    personalPhoto: null,
    passportCopy: null,
    otherDocuments: null
  });

  if (!isOpen) return null;

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleFileChange = (e) => {
    const { name, files: selectedFiles } = e.target;
    setFiles(prev => ({
      ...prev,
      [name]: selectedFiles[0] || null
    }));
  };

  const handleSubmit = async () => {
    if (!formData.agreedToTerms) {
      setError('You must agree to the Terms and Conditions.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const data = new FormData();
      Object.keys(formData).forEach(key => {
        data.append(key, formData[key]);
      });

      if (files.studyCertificate) data.append('studyCertificate', files.studyCertificate);
      if (files.personalPhoto) data.append('personalPhoto', files.personalPhoto);
      if (files.passportCopy) data.append('passportCopy', files.passportCopy);
      if (files.otherDocuments) data.append('otherDocuments', files.otherDocuments);

      const token = localStorage.getItem('token');
      const res = await axios.post('/api/applications/new', data, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (res.data.temporaryPassword) {
        alert(`Application created. Temporary client password: ${res.data.temporaryPassword}`);
      }

      onComplete();
      onClose();
    } catch (err) {
      console.error(err);
      setError(getApiErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const nextStep = () => setCurrentStep(prev => Math.min(prev + 1, 5));
  const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 1));

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-gray-50/50">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Create New Application</h2>
            <span className="inline-block mt-1 px-3 py-1 bg-blue-50 text-agency-blue text-xs font-bold uppercase tracking-wider rounded-full border border-blue-100">
              Service Counselor
            </span>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 bg-white px-6">
          {['Personal Info', 'Academic Info', 'Guardian Info', 'Documents', 'Review'].map((label, idx) => {
            const stepNum = idx + 1;
            const isActive = currentStep === stepNum;
            const isPast = currentStep > stepNum;
            return (
              <div 
                key={label}
                className={`flex-1 text-center py-4 text-sm font-semibold border-b-2 transition-colors ${
                  isActive ? 'border-agency-blue text-agency-blue' : 
                  isPast ? 'border-green-500 text-green-600' : 'border-transparent text-gray-400'
                }`}
              >
                {label}
              </div>
            );
          })}
        </div>

        {/* Form Content */}
        <div className="p-6 overflow-y-auto flex-1 bg-gray-50">
          {error && (
            <div className="mb-6 bg-red-50 text-red-600 p-4 rounded-lg border border-red-200 text-sm font-medium">
              {error}
            </div>
          )}

          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm space-y-6">
            
            {/* STEP 1: Personal Info */}
            {currentStep === 1 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">First Name *</label>
                  <input type="text" name="firstName" value={formData.firstName} onChange={handleInputChange} className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 outline-none focus:border-agency-blue focus:ring-1 focus:ring-agency-blue" required />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Last Name</label>
                  <input type="text" name="lastName" value={formData.lastName} onChange={handleInputChange} className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 outline-none focus:border-agency-blue focus:ring-1 focus:ring-agency-blue" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Email *</label>
                  <input type="email" name="email" value={formData.email} onChange={handleInputChange} className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 outline-none focus:border-agency-blue focus:ring-1 focus:ring-agency-blue" required />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Phone Number</label>
                  <input type="tel" name="phone" value={formData.phone} onChange={handleInputChange} className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 outline-none focus:border-agency-blue focus:ring-1 focus:ring-agency-blue" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Passport Number</label>
                  <input type="text" name="passportNo" value={formData.passportNo} onChange={handleInputChange} className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 outline-none focus:border-agency-blue focus:ring-1 focus:ring-agency-blue" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Nationality</label>
                  <input type="text" name="nationality" value={formData.nationality} onChange={handleInputChange} className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 outline-none focus:border-agency-blue focus:ring-1 focus:ring-agency-blue" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Country of Residence</label>
                  <input type="text" name="country" value={formData.country} onChange={handleInputChange} className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 outline-none focus:border-agency-blue focus:ring-1 focus:ring-agency-blue" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">City</label>
                  <input type="text" name="city" value={formData.city} onChange={handleInputChange} className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 outline-none focus:border-agency-blue focus:ring-1 focus:ring-agency-blue" />
                </div>
              </div>
            )}

            {/* STEP 2: Academic Info */}
            {currentStep === 2 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">University Name *</label>
                  <input type="text" name="universityName" value={formData.universityName} onChange={handleInputChange} className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 outline-none focus:border-agency-blue focus:ring-1 focus:ring-agency-blue" required />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Study Program *</label>
                  <input type="text" name="studyProgram" value={formData.studyProgram} onChange={handleInputChange} className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 outline-none focus:border-agency-blue focus:ring-1 focus:ring-agency-blue" required />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Study Location (e.g., Malaysia)</label>
                  <input type="text" name="studyLocation" value={formData.studyLocation} onChange={handleInputChange} className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 outline-none focus:border-agency-blue focus:ring-1 focus:ring-agency-blue" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Qualification (e.g., Bachelor)</label>
                  <input type="text" name="qualification" value={formData.qualification} onChange={handleInputChange} className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 outline-none focus:border-agency-blue focus:ring-1 focus:ring-agency-blue" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Study Duration (Months)</label>
                  <input type="number" name="studyDuration" value={formData.studyDuration} onChange={handleInputChange} className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 outline-none focus:border-agency-blue focus:ring-1 focus:ring-agency-blue" />
                </div>
              </div>
            )}

            {/* STEP 3: Guardian Info */}
            {currentStep === 3 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Guardian Name</label>
                  <input type="text" name="guardianName" value={formData.guardianName} onChange={handleInputChange} className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 outline-none focus:border-agency-blue focus:ring-1 focus:ring-agency-blue" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Guardian Phone</label>
                  <input type="tel" name="guardianPhone" value={formData.guardianPhone} onChange={handleInputChange} className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 outline-none focus:border-agency-blue focus:ring-1 focus:ring-agency-blue" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Guardian Email</label>
                  <input type="email" name="guardianEmail" value={formData.guardianEmail} onChange={handleInputChange} className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 outline-none focus:border-agency-blue focus:ring-1 focus:ring-agency-blue" />
                </div>
              </div>
            )}

            {/* STEP 4: Documents */}
            {currentStep === 4 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[
                  { name: 'studyCertificate', label: 'Study Certificate', max: 'Max 5MB' },
                  { name: 'personalPhoto', label: 'Personal Photo', max: 'Max 2MB' },
                  { name: 'passportCopy', label: 'Passport Copy', max: 'Max 2MB' },
                  { name: 'otherDocuments', label: 'Other Documents', max: 'Max 5MB' }
                ].map((doc) => (
                  <div key={doc.name} className="border-2 border-dashed border-gray-300 rounded-xl p-6 flex flex-col items-center justify-center bg-gray-50 hover:bg-gray-100 transition-colors relative cursor-pointer group">
                    <input type="file" name={doc.name} accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                    <UploadCloud className="h-8 w-8 text-agency-blue mb-2 group-hover:scale-110 transition-transform" />
                    <p className="text-sm font-bold text-gray-800">{doc.label}</p>
                    <p className="text-xs text-gray-500 mt-1">{files[doc.name] ? files[doc.name].name : doc.max}</p>
                    {files[doc.name] && <CheckCircle className="h-4 w-4 text-green-500 absolute top-3 right-3" />}
                  </div>
                ))}
              </div>
            )}

            {/* STEP 5: Review & Submit */}
            {currentStep === 5 && (
              <div className="space-y-6">
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <h3 className="font-bold text-gray-800 mb-4 border-b pb-2 flex items-center"><FileText className="mr-2 h-5 w-5 text-agency-blue" /> Uploaded Documents</h3>
                  <ul className="space-y-2 text-sm text-gray-700">
                    <li><strong>Study Certificate:</strong> {files.studyCertificate ? 'Attached' : 'Missing'}</li>
                    <li><strong>Personal Photo:</strong> {files.personalPhoto ? 'Attached' : 'Missing'}</li>
                    <li><strong>Passport Copy:</strong> {files.passportCopy ? 'Attached' : 'Missing'}</li>
                    <li><strong>Other Documents:</strong> {files.otherDocuments ? 'Attached' : 'Missing'}</li>
                  </ul>
                </div>
                
                <div className="flex items-start p-4 bg-blue-50/50 border border-blue-100 rounded-lg">
                  <input type="checkbox" name="agreedToTerms" id="terms" checked={formData.agreedToTerms} onChange={handleInputChange} className="mt-1 mr-3 h-4 w-4 text-agency-blue border-gray-300 rounded focus:ring-agency-blue cursor-pointer" />
                  <label htmlFor="terms" className="text-sm text-gray-700 cursor-pointer">
                    I confirm that all provided personal, academic, and guardian information is accurate. I agree to the Tasheer Agency Terms and Conditions regarding application processing.
                  </label>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Footer / Bottom Navigation */}
        <div className="p-6 border-t border-gray-100 bg-white flex justify-between items-center">
          <button 
            onClick={prevStep}
            disabled={currentStep === 1 || isLoading}
            className="px-6 py-2.5 rounded-lg font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 transition-colors"
          >
            Previous
          </button>

          {currentStep < 5 ? (
            <button 
              onClick={nextStep}
              className="px-6 py-2.5 rounded-lg font-semibold text-white bg-agency-blue hover:bg-agency-lightBlue transition-colors shadow-sm"
            >
              Next Step
            </button>
          ) : (
            <button 
              onClick={handleSubmit}
              disabled={isLoading || !formData.agreedToTerms}
              className="px-8 py-2.5 rounded-lg font-bold text-white bg-green-600 hover:bg-green-700 transition-colors shadow-md disabled:opacity-50 flex items-center"
            >
              {isLoading ? 'Submitting...' : 'Submit Application'}
            </button>
          )}
        </div>

      </div>
    </div>
  );
};

export default NewApplicationModal;
