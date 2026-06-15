import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { AlertCircle, CheckCircle2, FileCheck2, FileText, FileUp, GraduationCap, Phone, Send, User, UserCheck, Users, X } from 'lucide-react';
import ClientDocumentsGrid from './ClientDocumentsGrid';

const DetailCard = ({ label, value }) => (
  <div className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
    <p className="text-xs font-bold uppercase tracking-wide text-gray-400">{label}</p>
    <p className="mt-1 text-sm font-semibold text-gray-800">{value || 'Not provided'}</p>
  </div>
);

const STAGES = [
  'No Application',
  'Initial Inquiry',
  'Document Submission',
  'Document Verification',
  'University Application',
  'Offer Letter Issued',
  'EMGS/VAL Processing',
  'VAL Issued',
  'Pre-Departure',
  'Arrival & Endorsement'
];

const departmentAliases = {
  Ops: 'Operations',
  Accountant: 'Finance',
  'Financial Manager': 'Finance',
  Counselor: 'Counselor',
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

const normalizeApplicationStatus = (status) => {
  const statusMap = {
    'Pending Documents': 'PENDING_DOCS',
    'Applied for OL': 'APPLIED_FOR_OL',
    'Waiting for OL': 'WAITING_FOR_OL',
    'Pending Operations': 'PENDING_OFFER_APPLY',
    'Admission Issued': 'OFFER_UPLOADED',
    'Under Review': 'DOCS_VERIFICATION'
  };
  return statusMap[status] || status || '';
};

const paymentVisaStatuses = ['PAYMENT_VERIFIED', 'VISA_PROCESSING', 'VISA_COMPLETED', 'FLIGHT_BOOKED', 'ARRIVED', 'COMPLETED'];

const getInitialApplicationStatus = (clientData) => {
  const normalizedStatus = normalizeApplicationStatus(clientData?.app_status || clientData?.status);
  const studentDownloadStatuses = ['OFFER_APPROVED', 'PENDING_INVOICE_APPROVAL', 'PENDING_PAYMENT', 'PAYMENT_VERIFIED', 'VISA_PROCESSING', 'VISA_COMPLETED'];

  if (clientData?.offer_letter_url && !studentDownloadStatuses.includes(normalizedStatus)) {
    return 'OFFER_UPLOADED';
  }

  return normalizedStatus;
};

const ViewClientModal = ({ clientData, isOpen, onClose, onSuccess }) => {
  const [documents, setDocuments] = useState([]);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
  const [actionLoading, setActionLoading] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [actionError, setActionError] = useState('');
  const [localStatus, setLocalStatus] = useState(() => getInitialApplicationStatus(clientData));
  const [localOfferLetterUrl, setLocalOfferLetterUrl] = useState(() => clientData?.offer_letter_url || '');
  const [localAssignedCounselorName, setLocalAssignedCounselorName] = useState(() => clientData?.assigned_counselor_name || '');
  const [localVisaProgress, setLocalVisaProgress] = useState(() => Number(clientData?.visa_progress || 0));
  const [offerFile, setOfferFile] = useState(null);
  const [visaFile, setVisaFile] = useState(null);
  const [counselors, setCounselors] = useState([]);
  const [selectedCounselorId, setSelectedCounselorId] = useState('');

  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const currentDepartment = normalizeDepartment(currentUser);

  useEffect(() => {
    if (!isOpen || !clientData) return;

    const fetchDocuments = async () => {
      try {
        setIsLoadingDocuments(true);
        const token = localStorage.getItem('token');
        const res = await axios.get(`/api/clients/${clientData.id}/documents`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setDocuments(Array.isArray(res.data) ? res.data : []);
      } catch (error) {
        console.error('Error fetching client documents:', error);
        setDocuments([]);
      } finally {
        setIsLoadingDocuments(false);
      }
    };

    fetchDocuments();
  }, [clientData, isOpen]);

  useEffect(() => {
    if (!isOpen || currentDepartment !== 'Customer Service') return undefined;

    const timer = window.setTimeout(async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get('/api/staff?department=Counselor', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setCounselors(Array.isArray(res.data) ? res.data : []);
      } catch (error) {
        console.error('Error fetching counselors:', error);
        setCounselors([]);
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, [currentDepartment, isOpen]);

  if (!isOpen || !clientData) return null;

  const stageLabel = clientData?.current_stage ? STAGES[clientData.current_stage] : 'No application started';
  const statusLabel = localStatus || 'No status yet';
  const counselorLabel = localAssignedCounselorName || 'Unassigned';
  const applicationId = clientData?.application_id || clientData?.app_id;
  const offerLetterWorkflowStatuses = [
    'PENDING_OFFER_APPLY',
    'OFFER_PROCESSING',
    'OFFER_UPLOADED',
    'OFFER_APPROVED',
    'PENDING_INVOICE_APPROVAL',
    'PENDING_PAYMENT',
    'PAYMENT_VERIFIED',
    'VISA_PROCESSING',
    'VISA_COMPLETED',
    'APPLIED_FOR_OL',
    'WAITING_FOR_OL'
  ];
  const canRequestCounselorDocs = applicationId && localStatus === 'DOCS_VERIFICATION';
  const canCustomerServiceReview = currentDepartment === 'Customer Service' && applicationId && ['PENDING_CS_REVIEW', 'PENDING_DOCS', 'COUNSELOR_ASSIGNED', 'DOCS_VERIFICATION'].includes(localStatus);
  const canCustomerServiceAssign = canCustomerServiceReview && (!localAssignedCounselorName || localStatus === 'PENDING_CS_REVIEW' || localStatus === 'PENDING_DOCS');
  const canCustomerServiceMissingDocs = canCustomerServiceReview && localStatus !== 'PENDING_DOCS';
  const canApplyForOffer = applicationId && !offerLetterWorkflowStatuses.includes(localStatus);
  const isWaitingOnOperations = ['PENDING_OFFER_APPLY', 'OFFER_PROCESSING'].includes(localStatus);
  const canApproveOffer = applicationId && localStatus === 'OFFER_UPLOADED';
  const canCompleteVisa = applicationId && localStatus === 'VISA_PROCESSING';
  const canOperationsBeginOffer = applicationId && localStatus === 'PENDING_OFFER_APPLY';
  const canOperationsUploadOffer = applicationId && localStatus === 'OFFER_PROCESSING';
  const canOperationsApplyVisa = applicationId && localStatus === 'PAYMENT_VERIFIED';
  const proofOfPaymentUrl = clientData?.receipt_url || clientData?.receipt_path || '';
  const scopedDocuments = documents.filter(doc => !applicationId || Number(doc?.application_id || doc?.app_id) === Number(applicationId));
  const canAccessPaymentVisaStage = paymentVisaStatuses.includes(localStatus);
  const visaDocument = scopedDocuments.find(doc => String(doc?.document_type || '').toLowerCase().includes('visa'));

  const handleMissingDocuments = async () => {
    if (!applicationId) {
      setActionError('This client has no application to update.');
      return;
    }

    try {
      setActionLoading('missing-documents');
      setActionError('');
      setActionMessage('');
      const token = localStorage.getItem('token');
      const missingDocsNote = window.prompt('Enter the missing documents note for the client:') || '';
      await axios.post(`/api/applications/${applicationId}/missing-documents`, { missing_docs_note: missingDocsNote }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLocalStatus('PENDING_DOCS');
      setActionMessage('Missing documents request sent to the client.');
      if (onSuccess) await onSuccess();
    } catch (error) {
      console.error('Error requesting missing documents:', error);
      setActionError(error.response?.data?.message || 'Unable to request missing documents.');
    } finally {
      setActionLoading('');
    }
  };

  const handleAssignCounselor = async (event) => {
    event.preventDefault();

    if (!applicationId || !selectedCounselorId) {
      setActionError('Please select a counselor to assign.');
      return;
    }

    try {
      setActionLoading('assign-counselor');
      setActionError('');
      setActionMessage('');
      const token = localStorage.getItem('token');
      const res = await axios.put(`/api/applications/${applicationId}/assign-counselor`, {
        counselor_id: selectedCounselorId
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLocalStatus(res.data?.application?.status || 'COUNSELOR_ASSIGNED');
      const assignedCounselor = counselors.find(counselor => Number(counselor.id) === Number(selectedCounselorId));
      setLocalAssignedCounselorName(res.data?.application?.assigned_staff_name || assignedCounselor?.full_name || '');
      setActionMessage('Counselor assigned successfully.');
      if (onSuccess) await onSuccess();
    } catch (error) {
      console.error('Error assigning counselor:', error);
      setActionError(error.response?.data?.message || 'Unable to assign counselor.');
    } finally {
      setActionLoading('');
    }
  };

  const handleApplyForOfferLetter = async () => {
    if (!applicationId) {
      setActionError('This client has no application to update.');
      return;
    }

    try {
      setActionLoading('apply-offer');
      setActionError('');
      setActionMessage('');
      const token = localStorage.getItem('token');
      const res = await axios.put(`/api/applications/${applicationId}/advance-state`, {
        new_status: 'PENDING_OFFER_APPLY'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const nextStatus = res.data?.application?.status || 'PENDING_OFFER_APPLY';
      setLocalStatus(nextStatus);
      setActionMessage('Application sent to Operations for offer letter processing.');
      if (onSuccess) await onSuccess();
    } catch (error) {
      console.error('Error applying for offer letter:', error);
      setActionError(error.response?.data?.message || 'Unable to apply for offer letter.');
    } finally {
      setActionLoading('');
    }
  };

  const handleApproveOfferLetter = async () => {
    if (!applicationId) {
      setActionError('This client has no application to update.');
      return;
    }

    try {
      setActionLoading('approve-offer');
      setActionError('');
      setActionMessage('');
      const token = localStorage.getItem('token');
      const res = await axios.put(`/api/applications/${applicationId}/advance-state`, {
        new_status: 'OFFER_APPROVED'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLocalStatus(res.data?.application?.status || 'OFFER_APPROVED');
      setLocalOfferLetterUrl(res.data?.application?.offer_letter_url || localOfferLetterUrl);
      setActionMessage('Offer letter approved. The student can now download it.');
      if (onSuccess) await onSuccess();
    } catch (error) {
      console.error('Error approving offer letter:', error);
      setActionError(error.response?.data?.message || 'Unable to approve offer letter.');
    } finally {
      setActionLoading('');
    }
  };

  const handleBeginOfferProcessing = async () => {
    if (!applicationId) {
      setActionError('This client has no application to update.');
      return;
    }

    try {
      setActionLoading('begin-offer-processing');
      setActionError('');
      setActionMessage('');
      const token = localStorage.getItem('token');
      const res = await axios.put(`/api/applications/${applicationId}/advance-state`, {
        new_status: 'OFFER_PROCESSING'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLocalStatus(res.data?.application?.status || 'OFFER_PROCESSING');
      setActionMessage('Status updated to Waiting for OL.');
      if (onSuccess) await onSuccess();
    } catch (error) {
      console.error('Error beginning offer processing:', error);
      setActionError(error.response?.data?.message || 'Unable to begin offer processing.');
    } finally {
      setActionLoading('');
    }
  };

  const handleOperationsOfferUpload = async () => {
    if (!applicationId) {
      setActionError('This client has no application to update.');
      return;
    }

    if (!offerFile) {
      setActionError('Please choose an offer letter file first.');
      return;
    }

    try {
      setActionLoading('upload-offer');
      setActionError('');
      setActionMessage('');
      const token = localStorage.getItem('token');
      const payload = new FormData();
      payload.append('new_status', 'OFFER_UPLOADED');
      payload.append('offer_letter', offerFile);
      const res = await axios.put(`/api/applications/${applicationId}/advance-state`, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      setLocalStatus(res.data?.application?.status || 'OFFER_UPLOADED');
      setLocalOfferLetterUrl(res.data?.application?.offer_letter_url || localOfferLetterUrl);
      setOfferFile(null);
      setActionMessage('Offer letter uploaded and sent to Counselor for approval.');
      if (onSuccess) await onSuccess();
    } catch (error) {
      console.error('Error uploading offer letter:', error);
      setActionError(error.response?.data?.message || 'Unable to upload offer letter.');
    } finally {
      setActionLoading('');
    }
  };

  const handleOperationsVisaApplied = async () => {
    if (!applicationId) {
      setActionError('This client has no application to update.');
      return;
    }

    if (!visaFile) {
      setActionError('Please choose a visa document first.');
      return;
    }

    try {
      setActionLoading('visa-applied');
      setActionError('');
      setActionMessage('');
      const token = localStorage.getItem('token');
      const payload = new FormData();
      payload.append('new_status', 'VISA_PROCESSING');
      payload.append('visa_document', visaFile);
      const res = await axios.put(`/api/applications/${applicationId}/advance-state`, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      setLocalStatus(res.data?.application?.status || 'VISA_PROCESSING');
      setVisaFile(null);
      setActionMessage('Visa document uploaded. Status updated to Visa Processing.');
      if (onSuccess) await onSuccess();
    } catch (error) {
      console.error('Error applying for visa:', error);
      setActionError(error.response?.data?.message || 'Unable to update visa processing status.');
    } finally {
      setActionLoading('');
    }
  };

  const handleVisaCompleted = async () => {
    if (!applicationId) {
      setActionError('This client has no application to update.');
      return;
    }

    try {
      setActionLoading('visa-completed');
      setActionError('');
      setActionMessage('');
      const token = localStorage.getItem('token');
      const res = await axios.put(`/api/applications/${applicationId}/advance-state`, {
        new_status: 'VISA_COMPLETED'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLocalStatus(res.data?.application?.status || 'VISA_COMPLETED');
      setActionMessage('Visa marked as completed.');
      if (onSuccess) await onSuccess();
    } catch (error) {
      console.error('Error completing visa:', error);
      setActionError(error.response?.data?.message || 'Unable to mark visa as completed.');
    } finally {
      setActionLoading('');
    }
  };

  const handleVisaProgressUpdate = async () => {
    if (!applicationId) {
      setActionError('This client has no application to update.');
      return;
    }

    if (Number(localVisaProgress) === 100) {
      const confirmed = window.confirm('Setting progress to 100% will finalize the Visa stage. Are you sure?');
      if (!confirmed) return;
    }

    try {
      setActionLoading('visa-progress');
      setActionError('');
      setActionMessage('');
      const token = localStorage.getItem('token');
      const res = await axios.put(`/api/applications/${applicationId}/visa-progress`, {
        progress: Number(localVisaProgress)
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLocalVisaProgress(Number(res.data?.application?.visa_progress ?? localVisaProgress));
      setLocalStatus(res.data?.application?.status || (Number(localVisaProgress) === 100 ? 'VISA_COMPLETED' : localStatus));
      setActionMessage(Number(localVisaProgress) === 100 ? 'Visa stage finalized.' : 'Visa progress updated.');
      if (onSuccess) await onSuccess();
    } catch (error) {
      console.error('Error updating visa progress:', error);
      setActionError(error.response?.data?.message || 'Unable to update visa progress.');
    } finally {
      setActionLoading('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-lg">
        <div className="flex items-start justify-between border-b border-gray-100 px-6 py-5">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Client Details</h2>
            <p className="mt-1 text-sm text-gray-500">Overview for {clientData?.name || 'selected client'}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setActionMessage('');
              setActionError('');
              onClose();
            }}
            className="rounded-full p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
            aria-label="Close client details modal"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-6 overflow-y-auto bg-gray-50 px-6 py-6">
          <section>
            <div className="mb-4 flex items-center gap-2">
              <div className="rounded-lg bg-blue-50 p-2 text-agency-blue">
                <User size={18} />
              </div>
              <h3 className="text-base font-bold text-gray-900">Personal Info</h3>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <DetailCard label="Name" value={clientData?.name} />
              <DetailCard label="Email" value={clientData?.email} />
              <DetailCard label="Phone" value={clientData?.phone} />
              <DetailCard label="Passport" value={clientData?.passport_no} />
              <DetailCard label="Nationality" value={clientData?.nationality} />
            </div>
          </section>

          <section>
            <div className="mb-4 flex items-center gap-2">
              <div className="rounded-lg bg-blue-50 p-2 text-agency-blue">
                <Users size={18} />
              </div>
              <h3 className="text-base font-bold text-gray-900">Guardian Information</h3>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <DetailCard label="Guardian Name" value={clientData?.guardian_name} />
              <DetailCard label="Guardian Phone" value={clientData?.guardian_phone} />
              <DetailCard label="Guardian Email" value={clientData?.guardian_email} />
            </div>
          </section>

          <section>
            <div className="mb-4 flex items-center gap-2">
              <div className="rounded-lg bg-blue-50 p-2 text-agency-blue">
                <GraduationCap size={18} />
              </div>
              <h3 className="text-base font-bold text-gray-900">Academic Information</h3>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <DetailCard label="University" value={clientData?.university_name} />
              <DetailCard label="Program" value={clientData?.program_name} />
              <DetailCard label="Qualification" value={clientData?.qualification} />
              <DetailCard label="Location" value={clientData?.study_location} />
              <DetailCard label="Duration" value={clientData?.study_duration_months ? `${clientData.study_duration_months} months` : null} />
            </div>
          </section>

          <section>
            <div className="mb-4 flex items-center gap-2">
              <div className="rounded-lg bg-blue-50 p-2 text-agency-blue">
                <Phone size={18} />
              </div>
              <h3 className="text-base font-bold text-gray-900">Application Status</h3>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <DetailCard label="Current Stage" value={stageLabel} />
              <DetailCard label="Status" value={statusLabel} />
              <DetailCard label="Assigned Counselor" value={counselorLabel} />
            </div>
          </section>

          {canAccessPaymentVisaStage && (proofOfPaymentUrl || visaDocument?.file_path) && (
            <section className="space-y-4">
              {visaDocument?.file_path && (
                <div className="rounded-2xl border border-blue-100 bg-blue-50 px-5 py-4 shadow-sm">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <span className="inline-flex rounded-full bg-blue-600 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-white">
                        Visa Processing
                      </span>
                      <h3 className="mt-3 text-lg font-black text-blue-950">Visa processing document</h3>
                      <p className="mt-1 text-sm font-bold leading-6 text-blue-700">
                        View or download the visa document uploaded by Operations.
                      </p>
                    </div>
                    <a
                      href={visaDocument?.file_path}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-sm hover:bg-blue-700"
                    >
                      <FileText size={16} />
                      View/Download Visa
                    </a>
                  </div>
                </div>
              )}

              {proofOfPaymentUrl && (
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-4 shadow-sm">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <span className="inline-flex rounded-full bg-emerald-600 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-white">
                        Visa Payment Proof
                      </span>
                      <h3 className="mt-3 text-lg font-black text-emerald-950">Proof of payment uploaded by client</h3>
                      <p className="mt-1 text-sm font-bold leading-6 text-emerald-700">
                        Review or download the visa payment receipt submitted by the student.
                      </p>
                    </div>
                    <a
                      href={proofOfPaymentUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-sm hover:bg-emerald-700"
                    >
                      <FileText size={16} />
                      View/Download Proof
                    </a>
                  </div>
                </div>
              )}
            </section>
          )}

          <ClientDocumentsGrid documents={scopedDocuments} isLoading={isLoadingDocuments} />

          {currentDepartment === 'Customer Service' && (
            <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <div className="rounded-lg bg-blue-50 p-2 text-agency-blue">
                  <UserCheck size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Customer Service Review</h3>
                  <p className="text-sm text-gray-500">Assign this student to a counselor or request missing documents.</p>
                </div>
              </div>

              {actionMessage && (
                <div className="mb-3 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
                  {actionMessage}
                </div>
              )}
              {actionError && (
                <div className="mb-3 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
                  {actionError}
                </div>
              )}

              {canCustomerServiceReview ? (
                <div className="space-y-4">
                  {canCustomerServiceAssign && (
                    <form onSubmit={handleAssignCounselor} className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
                      <select
                        value={selectedCounselorId}
                        onChange={event => setSelectedCounselorId(event.target.value)}
                        className="h-12 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-600 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-50"
                        required
                      >
                        <option value="">Select counselor</option>
                        {counselors.map(counselor => (
                          <option key={counselor.id} value={counselor.id}>{counselor.full_name}</option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        disabled={!selectedCounselorId || actionLoading === 'assign-counselor'}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <UserCheck size={17} />
                        {actionLoading === 'assign-counselor' ? 'Assigning...' : 'Assign Staff'}
                      </button>
                    </form>
                  )}

                  {counselors.length === 0 && canCustomerServiceAssign && (
                    <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-700">
                      No counselors are available to assign.
                    </div>
                  )}

                  {canCustomerServiceMissingDocs && (
                    <button
                      type="button"
                      onClick={handleMissingDocuments}
                      disabled={actionLoading === 'missing-documents'}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-black text-amber-700 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <AlertCircle size={17} />
                      {actionLoading === 'missing-documents' ? 'Sending...' : 'Set as Missing Documents'}
                    </button>
                  )}

                  {localStatus === 'PENDING_DOCS' && (
                    <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-700">
                      Waiting for the student to upload the requested missing documents.
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm font-bold text-gray-600">
                  No Customer Service action is available for the current status.
                </div>
              )}
            </section>
          )}

          {currentDepartment === 'Counselor' && (
            <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <div className="rounded-lg bg-blue-50 p-2 text-agency-blue">
                  <CheckCircle2 size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Counselor Actions</h3>
                  <p className="text-sm text-gray-500">Confirm document readiness or request client updates.</p>
                </div>
              </div>

              {actionMessage && (
                <div className="mb-3 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
                  {actionMessage}
                </div>
              )}
              {actionError && (
                <div className="mb-3 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
                  {actionError}
                </div>
              )}

              {canApplyForOffer && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {localStatus === 'DOCS_VERIFICATION' && (
                    <button
                      type="button"
                      onClick={handleMissingDocuments}
                      disabled={!canRequestCounselorDocs || actionLoading === 'missing-documents'}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-black text-amber-700 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <AlertCircle size={17} />
                      {actionLoading === 'missing-documents' ? 'Sending...' : 'Missing Documents'}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleApplyForOfferLetter}
                    disabled={!canApplyForOffer || actionLoading === 'apply-offer'}
                    className={`${localStatus !== 'DOCS_VERIFICATION' ? 'sm:col-span-2' : ''} inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    <Send size={17} />
                    {actionLoading === 'apply-offer' ? 'Applying...' : 'Apply for Offer Letter'}
                  </button>
                </div>
              )}

              {isWaitingOnOperations && (
                <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-800">
                  Waiting on Operations to process the offer letter...
                </div>
              )}

              {canApproveOffer && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <a
                    href={localOfferLetterUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-black text-blue-700 transition hover:bg-blue-100"
                  >
                    <FileText size={17} />
                    View Uploaded Offer
                  </a>
                  <button
                    type="button"
                    onClick={handleApproveOfferLetter}
                    disabled={actionLoading === 'approve-offer'}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <CheckCircle2 size={17} />
                    {actionLoading === 'approve-offer' ? 'Approving...' : 'Approved OL'}
                  </button>
                </div>
              )}

              {canCompleteVisa && (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-cyan-100 bg-cyan-50 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="text-sm font-black text-cyan-950">Visa Progress</p>
                      <span className="rounded-full bg-white px-3 py-1 text-sm font-black text-cyan-700">
                        {localVisaProgress}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      value={localVisaProgress}
                      onChange={event => setLocalVisaProgress(Number(event.target.value))}
                      className="h-2 w-full cursor-pointer accent-cyan-600"
                    />
                    <div className="mt-2 flex justify-between text-xs font-bold text-cyan-700/70">
                      <span>0%</span>
                      <span>50%</span>
                      <span>100%</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleVisaProgressUpdate}
                      disabled={actionLoading === 'visa-progress'}
                      className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <CheckCircle2 size={17} />
                      {actionLoading === 'visa-progress' ? 'Saving...' : 'Save Progress'}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleVisaCompleted}
                    disabled={actionLoading === 'visa-completed'}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <CheckCircle2 size={17} />
                    {actionLoading === 'visa-completed' ? 'Updating...' : 'Visa Completed'}
                  </button>
                </div>
              )}
            </section>
          )}

          {currentDepartment === 'Operations' && (
            <section className="rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600">
                  <FileUp size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Operations Actions</h3>
                  <p className="text-sm text-gray-500">Process university offer letter requests.</p>
                </div>
              </div>

              {actionMessage && (
                <div className="mb-3 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
                  {actionMessage}
                </div>
              )}
              {actionError && (
                <div className="mb-3 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
                  {actionError}
                </div>
              )}

              {canOperationsBeginOffer && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-800">
                    The Counselor has requested an offer letter. Please apply to the university manually, then update the status.
                  </div>
                  <button
                    type="button"
                    onClick={handleBeginOfferProcessing}
                    disabled={actionLoading === 'begin-offer-processing'}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Send size={17} />
                    {actionLoading === 'begin-offer-processing' ? 'Updating...' : 'Applied for OL'}
                  </button>
                </div>
              )}

              {canOperationsUploadOffer && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-800">
                    Application is currently processing at the university. Once you receive the official offer letter, upload it here.
                  </div>
                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-4 text-sm font-black text-gray-600 transition hover:bg-gray-100">
                    <FileUp size={17} />
                    {offerFile?.name || 'Choose offer letter PDF/image'}
                    <input
                      type="file"
                      accept=".pdf,image/*"
                      className="hidden"
                      onChange={event => setOfferFile(event.target.files?.[0] || null)}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={handleOperationsOfferUpload}
                    disabled={!offerFile || actionLoading === 'upload-offer'}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <FileUp size={17} />
                    {actionLoading === 'upload-offer' ? 'Uploading...' : 'Upload Offer Letter'}
                  </button>
                </div>
              )}

              {canOperationsApplyVisa && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">
                    Payment is marked as paid. Upload the visa document, then mark the visa as applied.
                  </div>
                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-4 text-sm font-black text-gray-600 transition hover:bg-gray-100">
                    <FileUp size={17} />
                    {visaFile?.name || 'Choose visa document PDF/image'}
                    <input
                      type="file"
                      accept=".pdf,image/*"
                      className="hidden"
                      onChange={event => setVisaFile(event.target.files?.[0] || null)}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={handleOperationsVisaApplied}
                    disabled={!visaFile || actionLoading === 'visa-applied'}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <FileCheck2 size={17} />
                    {actionLoading === 'visa-applied' ? 'Updating...' : 'Visa Applied'}
                  </button>
                </div>
              )}

              {!canOperationsBeginOffer && !canOperationsUploadOffer && !canOperationsApplyVisa && (
                <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm font-bold text-gray-600">
                  No Operations action is available for the current status.
                </div>
              )}
            </section>
          )}
        </div>

        <div className="flex flex-col gap-3 border-t border-gray-100 bg-white px-6 py-4 sm:flex-row sm:items-center sm:justify-end">
          {currentDepartment === 'Counselor' && canApplyForOffer && (
            <button
              type="button"
              onClick={handleApplyForOfferLetter}
              disabled={actionLoading === 'apply-offer'}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Send size={16} />
              {actionLoading === 'apply-offer' ? 'Applying...' : 'Apply for OL'}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setActionMessage('');
              setActionError('');
              onClose();
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-agency-blue px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-agency-lightBlue"
          >
            <FileText size={16} />
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ViewClientModal;
