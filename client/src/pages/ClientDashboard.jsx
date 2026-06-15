import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import Confetti from 'react-confetti';
import { useDropzone } from 'react-dropzone';
import Skeleton from 'react-loading-skeleton';
import toast from 'react-hot-toast';
import {
  CalendarDays,
  CheckCircle2,
  CreditCard,
  Download,
  Eye,
  FileText,
  MessageCircle,
  Plane,
  Upload,
  Video,
  X
} from 'lucide-react';
import ClientDocumentsGrid from '../components/ClientDocumentsGrid';
import CreateApplicationModal from '../components/CreateApplicationModal';
import PaymentGatewayModal from '../components/PaymentGatewayModal';
import { connectUserSocket, socket } from '../utils/socket';

const trackerStages = [
  'Under Review',
  'Applied for Offer Letter',
  'Waiting for Offer Letter',
  'Admission Issued',
  'Pending Payment',
  'Waiting for Payment Verification',
  'Paid',
  'Visa Processing',
  'Visa Completed'
];

const paymentVisaStatuses = ['PAYMENT_VERIFIED', 'VISA_PROCESSING', 'VISA_COMPLETED', 'FLIGHT_BOOKED', 'ARRIVED', 'COMPLETED'];

const formatCurrentDate = () => new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric'
}).format(new Date());

const formatMeetingDateTime = (value) => {
  if (!value) return 'Not scheduled';
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
};

const getDatetimeLocalMin = () => {
  const date = new Date(Date.now() + 60 * 60 * 1000);
  date.setSeconds(0, 0);
  return date.toISOString().slice(0, 16);
};

const getMeetingStartTime = (meeting) => (
  meeting?.status === 'PROPOSED' && meeting?.proposed_time
    ? new Date(meeting.proposed_time).getTime()
    : new Date(meeting?.requested_time).getTime()
);

const isMeetingStillActive = (meeting, now) => {
  const startTime = getMeetingStartTime(meeting);
  if (!Number.isFinite(startTime) || !Number.isFinite(now)) return false;

  const durationMinutes = Number(meeting?.duration || 30);
  const durationMs = (Number.isFinite(durationMinutes) && durationMinutes > 0 ? durationMinutes : 30) * 60 * 1000;
  return startTime + durationMs > now;
};

const getStage = (client) => {
  if (!client?.application_id) return 'No Application';
  if (client.app_status === 'VISA_COMPLETED') return 'Visa Completed';
  if (['ACCOMMODATION_READY', 'FLIGHT_BOOKED', 'ARRIVED', 'MEDICAL_CLEARED', 'COMPLETED'].includes(client.app_status)) return 'Visa Completed';
  if (client.app_status === 'VISA_PROCESSING') return 'Visa Processing';
  if (client.app_status === 'PAYMENT_VERIFIED') return 'Paid';
  if (client.app_status === 'WAITING_PAYMENT_VERIFICATION') return 'Waiting for Payment Verification';
  if (client.app_status === 'PENDING_PAYMENT') return 'Pending Payment';
  if (['OFFER_UPLOADED', 'OFFER_APPROVED', 'PENDING_INVOICE_APPROVAL'].includes(client.app_status)) return 'Admission Issued';
  if (client.app_status === 'WAITING_FOR_OL' || client.app_status === 'OFFER_PROCESSING') return 'Waiting for Offer Letter';
  if (client.app_status === 'APPLIED_FOR_OL' || client.app_status === 'PENDING_OFFER_APPLY') return 'Applied for Offer Letter';
  return 'Under Review';
};

const KpiCard = ({ label, value, icon, accent }) => {
  const Icon = icon;
  return (
  <article className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
    <div className={`mb-4 inline-flex rounded-xl border p-2.5 ${accent}`}>
      <Icon size={20} />
    </div>
    <p className="text-2xl font-black text-slate-950">{value}</p>
    <p className="mt-2 text-xs font-bold leading-5 text-slate-500">{label}</p>
  </article>
  );
};

const EmptyApplicationState = ({ onStart }) => (
  <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 py-12">
    <section className="w-full max-w-xl text-center">
      <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full bg-blue-50 text-blue-600">
        <svg className="h-16 w-16" viewBox="0 0 96 96" fill="none" aria-hidden="true">
          <path d="M18 28C18 23.5817 21.5817 20 26 20H40L48 28H70C74.4183 28 78 31.5817 78 36V68C78 72.4183 74.4183 76 70 76H26C21.5817 76 18 72.4183 18 68V28Z" fill="currentColor" opacity="0.12" />
          <path d="M18 35H78V68C78 72.4183 74.4183 76 70 76H26C21.5817 76 18 72.4183 18 68V35Z" stroke="currentColor" strokeWidth="5" strokeLinejoin="round" />
          <path d="M18 35V28C18 23.5817 21.5817 20 26 20H40L48 28H70C74.4183 28 78 31.5817 78 36V38" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M37 55H59M37 64H52" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
        </svg>
      </div>
      <h2 className="mt-7 text-3xl font-black tracking-tight text-slate-950">No Application Found</h2>
      <p className="mx-auto mt-3 max-w-md text-sm font-semibold leading-6 text-slate-500">
        You haven't started your university admission and visa journey yet.
      </p>
      <button
        type="button"
        onClick={onStart}
        className="mt-7 inline-flex h-12 items-center justify-center rounded-xl bg-blue-600 px-6 text-sm font-black text-white shadow-sm shadow-blue-100 transition hover:bg-blue-700"
      >
        Start New Application
      </button>
    </section>
  </div>
);

const ClientDashboard = () => {
  const [clientProfile, setClientProfile] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [isDocumentsLoading, setIsDocumentsLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingInvoice, setPendingInvoice] = useState(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [meetings, setMeetings] = useState([]);
  const [meetingCountdownTick, setMeetingCountdownTick] = useState(0);
  const [isMeetingModalOpen, setIsMeetingModalOpen] = useState(false);
  const [meetingForm, setMeetingForm] = useState({ topic: '', requested_time: '', duration: '30' });
  const [isSubmittingMeeting, setIsSubmittingMeeting] = useState(false);
  const [error, setError] = useState('');
  const [flightForm, setFlightForm] = useState({
    arrival_date: '',
    arrival_time: '',
    terminal: '',
    airport: '',
    airlines: '',
    trip_number: ''
  });
  const [ticketFile, setTicketFile] = useState(null);
  const [isSubmittingFlight, setIsSubmittingFlight] = useState(false);
  const [missingDocsFiles, setMissingDocsFiles] = useState([]);
  const [isSubmittingMissingDocs, setIsSubmittingMissingDocs] = useState(false);
  const [missingDocsUploadProgress, setMissingDocsUploadProgress] = useState(0);
  const [showOfferConfetti, setShowOfferConfetti] = useState(false);
  const [showFlightAnimation, setShowFlightAnimation] = useState(false);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const user = useMemo(() => JSON.parse(localStorage.getItem('user') || '{}'), []);
  const navigate = useNavigate();

  const fetchClientProfile = useCallback(async () => {
    try {
      setIsLoading(true);
      setError('');
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/clients/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setClientProfile(res.data);
    } catch (err) {
      console.error('Failed to fetch client profile:', err);
      setError('Failed to load your dashboard data.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchClientDocuments = useCallback(async () => {
    try {
      setIsDocumentsLoading(true);
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/clients/me/documents', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDocuments(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to fetch client documents:', err);
      setDocuments([]);
    } finally {
      setIsDocumentsLoading(false);
    }
  }, []);

  const fetchPendingInvoice = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/invoices/my', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const invoices = Array.isArray(res.data) ? res.data : [];
      setPendingInvoice(invoices.find(invoice => ['Pending', 'Overdue'].includes(invoice.payment_status)) || null);
    } catch (err) {
      console.error('Failed to fetch pending invoice:', err);
      setPendingInvoice(null);
    }
  }, []);

  const fetchMeetings = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/meetings', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMeetings(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to fetch meetings:', err);
      setMeetings([]);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetchClientProfile();
      fetchClientDocuments();
      fetchPendingInvoice();
      fetchMeetings();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [fetchClientDocuments, fetchClientProfile, fetchMeetings, fetchPendingInvoice]);

  useEffect(() => {
    if (!user?.id) return undefined;

    connectUserSocket(user);

    const handleVisaProgressUpdated = (payload) => {
      const payloadApplicationId = Number(payload?.application_id);
      const payloadClientId = Number(payload?.client_id);

      if (
        payloadApplicationId !== Number(clientProfile?.application_id) &&
        payloadClientId !== Number(user.id)
      ) {
        return;
      }

      setClientProfile(prev => ({
        ...prev,
        visa_progress: Number(payload?.visa_progress ?? prev?.visa_progress ?? 0),
        app_status: payload?.status || prev?.app_status
      }));
    };

    socket.on('visa_progress_updated', handleVisaProgressUpdated);
    return () => {
      socket.off('visa_progress_updated', handleVisaProgressUpdated);
    };
  }, [clientProfile?.application_id, user]);

  useEffect(() => {
    const startTimer = window.setTimeout(() => setMeetingCountdownTick(Date.now()), 0);
    const interval = window.setInterval(() => setMeetingCountdownTick(Date.now()), 1000);
    return () => {
      window.clearTimeout(startTimer);
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (window.location.hash === '#consultation') {
      const timer = window.setTimeout(() => {
        document.getElementById('consultation')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 150);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, []);

  useEffect(() => {
    if (clientProfile?.app_status === 'OFFER_UPLOADED') {
      const startTimer = window.setTimeout(() => setShowOfferConfetti(true), 0);
      const stopTimer = window.setTimeout(() => setShowOfferConfetti(false), 5000);
      return () => {
        window.clearTimeout(startTimer);
        window.clearTimeout(stopTimer);
      };
    }
    return undefined;
  }, [clientProfile?.app_status]);

  useEffect(() => {
    if (!clientProfile?.application_id) return;
    const isSafeFlightStatus = ['VISA_COMPLETED', 'FLIGHT_BOOKED', 'ARRIVED'].includes(clientProfile?.app_status);
    if (isSafeFlightStatus) {
      const startTimer = window.setTimeout(() => setShowFlightAnimation(true), 0);
      const stopTimer = window.setTimeout(() => setShowFlightAnimation(false), 4000);
      return () => {
        window.clearTimeout(startTimer);
        window.clearTimeout(stopTimer);
      };
    }
    return undefined;
  }, [clientProfile?.application_id, clientProfile?.app_status]);

  const currentStage = getStage(clientProfile);
  const currentStageIndex = trackerStages.indexOf(currentStage);
  const isFinalStage = currentStage === 'Visa Completed';
  const visaProgress = Math.min(100, Math.max(0, Number(clientProfile?.visa_progress || 0)));
  const shouldShowVisaProgress = ['VISA_PROCESSING', 'VISA_COMPLETED'].includes(clientProfile?.app_status);
  const hasApplication = Boolean(clientProfile?.application_id);
  const pendingInvoices = Number(clientProfile?.pending_invoices_count || 0);
  const uploadedDocuments = Number(clientProfile?.uploaded_documents_count || 0);
  const missingDocuments = hasApplication ? Math.max(0, 3 - uploadedDocuments) : 0;
  const unreadMessages = Number(clientProfile?.unread_messages_count || 0);
  const canBookFlight = false;
  const canDownloadOffer = ['OFFER_APPROVED', 'PENDING_INVOICE_APPROVAL', 'PENDING_PAYMENT', 'WAITING_PAYMENT_VERIFICATION', 'PAYMENT_VERIFIED', 'VISA_PROCESSING', 'VISA_COMPLETED', 'ACCOMMODATION_READY', 'FLIGHT_BOOKED', 'ARRIVED', 'MEDICAL_CLEARED', 'COMPLETED'].includes(clientProfile?.app_status) &&
    Boolean(clientProfile?.offer_letter_url);
  const applicationDocuments = documents.filter(doc => !clientProfile?.application_id || Number(doc?.application_id || doc?.app_id) === Number(clientProfile.application_id));
  const visaDocument = applicationDocuments.find(doc => String(doc?.document_type || '').toLowerCase().includes('visa'));
  const canAccessPaymentVisaStage = paymentVisaStatuses.includes(clientProfile?.app_status);
  const canDownloadVisaDocument = canAccessPaymentVisaStage &&
    Boolean(visaDocument?.file_path);
  const isPendingMissingDocs = clientProfile?.app_status === 'PENDING_DOCS';
  const shouldShowSafeFlightBanner = (
    clientProfile?.app_status === 'VISA_COMPLETED' ||
    (Number(clientProfile?.visa_progress || 0) >= 100 && clientProfile?.app_status === 'FLIGHT_BOOKED') ||
    clientProfile?.app_status === 'ARRIVED'
  );
  const upcomingMeetings = meetings.filter(meeting => (
    meetingCountdownTick > 0 &&
    ['PENDING', 'PROPOSED', 'STUDENT_ACCEPTED', 'APPROVED'].includes(meeting?.status) &&
    isMeetingStillActive(meeting, meetingCountdownTick)
  ));
  const meetingStatusStyles = {
    PENDING: 'bg-amber-50 text-amber-700',
    PROPOSED: 'bg-indigo-50 text-indigo-700',
    STUDENT_ACCEPTED: 'bg-blue-50 text-blue-700',
    APPROVED: 'bg-emerald-50 text-emerald-700'
  };
  const meetingStatusLabels = {
    PENDING: 'Waiting for Counselor Approval',
    PROPOSED: 'Counselor Proposed a New Time',
    STUDENT_ACCEPTED: 'Waiting for Counselor Approval',
    APPROVED: 'Approved'
  };

  const handleRequestMeeting = async (event) => {
    event.preventDefault();
    if (!clientProfile?.application_id) return;

    try {
      setIsSubmittingMeeting(true);
      const token = localStorage.getItem('token');
      await axios.post('/api/meetings', {
        application_id: clientProfile.application_id,
        topic: meetingForm.topic,
        requested_time: meetingForm.requested_time,
        duration: Number(meetingForm.duration)
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Meeting request sent to your counselor.');
      setMeetingForm({ topic: '', requested_time: '', duration: '30' });
      setIsMeetingModalOpen(false);
      await fetchMeetings();
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to request meeting.';
      toast.error(message);
      setError(message);
    } finally {
      setIsSubmittingMeeting(false);
    }
  };

  const handleAcceptProposedMeeting = async (meetingId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`/api/meetings/${meetingId}/student-accept`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Proposed meeting time accepted.');
      await fetchMeetings();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to accept proposed time.');
    }
  };

  const handleCancelMeeting = async (meetingId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`/api/meetings/${meetingId}/cancel`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Meeting request cancelled.');
      await fetchMeetings();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to cancel meeting.');
    }
  };

  const getMeetingCountdown = (meeting) => {
    if (!meetingCountdownTick) return 'Starts in: --d --h --m --s';
    const diff = new Date(meeting?.requested_time).getTime() - meetingCountdownTick;
    if (!Number.isFinite(diff) || diff <= 0) return 'Meeting is Starting Now';

    const totalSeconds = Math.floor(diff / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const pad = (value) => String(value).padStart(2, '0');

    return `Starts in: ${pad(days)}d ${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;
  };

  const handleFlightBooking = async (event) => {
    event.preventDefault();
    if (!ticketFile || !clientProfile?.application_id) return;

    try {
      setIsSubmittingFlight(true);
      const token = localStorage.getItem('token');
      const payload = new FormData();
      payload.append('new_status', 'FLIGHT_BOOKED');
      Object.entries(flightForm).forEach(([key, value]) => payload.append(key, value));
      payload.append('ticket', ticketFile);
      await axios.put(`/api/applications/${clientProfile.application_id}/advance-state`, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      setFlightForm({ arrival_date: '', arrival_time: '', terminal: '', airport: '', airlines: '', trip_number: '' });
      setTicketFile(null);
      await fetchClientProfile();
    } catch (err) {
      console.error('Failed to book flight:', err);
      setError(err.response?.data?.message || 'Failed to submit flight booking.');
    } finally {
      setIsSubmittingFlight(false);
    }
  };

  const handleMissingDocumentsUpload = async (event) => {
    event.preventDefault();
    if (!clientProfile?.application_id || missingDocsFiles.length === 0) return;

    try {
      setIsSubmittingMissingDocs(true);
      setMissingDocsUploadProgress(20);
      setError('');
      const token = localStorage.getItem('token');
      const payload = new FormData();
      missingDocsFiles.forEach(file => payload.append('missing_docs', file));
      setMissingDocsUploadProgress(55);
      await axios.put(`/api/applications/${clientProfile.application_id}/upload-missing-docs`, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      setMissingDocsUploadProgress(100);
      toast.success('Missing documents submitted.');
      setMissingDocsFiles([]);
      await fetchClientProfile();
      await fetchClientDocuments();
    } catch (err) {
      console.error('Failed to submit missing documents:', err);
      const message = err.response?.data?.message || 'Failed to submit missing documents.';
      setError(message);
      toast.error(message);
    } finally {
      setIsSubmittingMissingDocs(false);
      window.setTimeout(() => setMissingDocsUploadProgress(0), 800);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    multiple: true,
    onDrop: acceptedFiles => setMissingDocsFiles(acceptedFiles)
  });

  const kpis = useMemo(() => [
    { label: 'Current Stage', value: currentStage, icon: Eye, accent: 'bg-blue-50 text-blue-600 border-blue-100' },
    { label: 'Missing Documents', value: String(missingDocuments), icon: FileText, accent: 'bg-slate-50 text-slate-600 border-slate-200' },
    { label: 'Pending Invoices', value: String(pendingInvoices), icon: CreditCard, accent: 'bg-amber-50 text-amber-600 border-amber-100' },
    { label: 'Unread Messages', value: String(unreadMessages), icon: MessageCircle, accent: 'bg-indigo-50 text-indigo-600 border-indigo-100' }
  ], [currentStage, missingDocuments, pendingInvoices, unreadMessages]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton height={150} borderRadius={18} />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[1, 2, 3, 4].map(item => <Skeleton key={item} height={130} borderRadius={18} />)}
        </div>
        <Skeleton height={260} borderRadius={18} />
      </div>
    );
  }

  if (!hasApplication) {
    return (
      <div className="bg-slate-50" dir="ltr">
        {error && (
          <div className="mx-auto mt-6 max-w-xl rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
            {error}
          </div>
        )}
        <EmptyApplicationState onStart={() => setIsWizardOpen(true)} />
        <CreateApplicationModal
          isOpen={isWizardOpen}
          mode="client"
          onClose={() => setIsWizardOpen(false)}
          onSuccess={async () => {
            await Promise.all([
              fetchClientProfile(),
              fetchClientDocuments()
            ]);
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 bg-slate-50" dir="ltr">
      {showOfferConfetti && <Confetti width={window.innerWidth} height={window.innerHeight} recycle={false} numberOfPieces={220} />}
      {showFlightAnimation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-sky-950/80 text-white">
          <style>{`
            @keyframes tasheer-plane-flight {
              0% { transform: translateX(-55vw) translateY(28px) rotate(-8deg); opacity: 0; }
              15% { opacity: 1; }
              100% { transform: translateX(55vw) translateY(-42px) rotate(8deg); opacity: 0; }
            }
          `}</style>
          <div className="text-center">
            <Plane className="mx-auto mb-5 h-20 w-20 animate-[tasheer-plane-flight_4s_ease-in-out_forwards]" />
            <h2 className="text-3xl font-black">Tasheer Agency wishes you a safe flight!</h2>
          </div>
        </div>
      )}
      {error && (
        <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
          {error}
        </div>
      )}

      {shouldShowSafeFlightBanner && (
        <section className="overflow-hidden rounded-2xl border border-sky-100 bg-gradient-to-r from-sky-50 via-white to-emerald-50 p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="inline-flex rounded-full bg-sky-600 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-white">
                Safe Travels
              </span>
              <h2 className="mt-3 text-2xl font-black text-slate-950">Tasheer Agency wishes you a safe flight!</h2>
              <p className="mt-1 text-sm font-bold text-slate-500">Your visa journey is ready for travel. Keep your documents close and enjoy the next step.</p>
            </div>
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-600 text-white shadow-sm">
              <Plane size={30} />
            </div>
          </div>
        </section>
      )}

      <section className="overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-cyan-50 p-6 shadow-sm md:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white/80 px-3 py-2 text-sm font-bold text-blue-700 shadow-sm">
              <CalendarDays size={16} />
              {formatCurrentDate()}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-3xl font-black tracking-tight text-slate-950 md:text-4xl">
                Welcome, {clientProfile?.name || user.full_name || 'Student'}
              </h2>
              <span className="rounded-full bg-blue-600 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-white">
                Student
              </span>
            </div>
            <p className="mt-3 max-w-2xl text-base leading-7 text-slate-500">
              Track your application progress, required actions, payments, and communication from your counselor.
            </p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map(kpi => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </section>

      {hasApplication && (
        <section id="consultation" className="scroll-mt-24 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="inline-flex rounded-xl border border-blue-100 bg-blue-50 p-2.5 text-blue-600">
                <Video size={20} />
              </div>
              <h3 className="mt-3 text-xl font-black text-slate-950">Virtual Consultation</h3>
              <p className="mt-1 text-sm font-bold text-slate-500">Request a meeting with your assigned counselor and join once approved.</p>
            </div>
            <button
              type="button"
              onClick={() => setIsMeetingModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-sm hover:bg-blue-700"
            >
              <Video size={17} />
              Request Consultation
            </button>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-2">
            {upcomingMeetings.length === 0 ? (
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm font-bold text-slate-500">
                No pending or approved meetings yet.
              </div>
            ) : upcomingMeetings.map(meeting => (
              <article key={meeting.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-black text-slate-950">{meeting.topic}</p>
                    <p className="mt-1 text-xs font-bold text-slate-500">
                      Requested: {formatMeetingDateTime(meeting.requested_time)} · {meeting.duration || 30} mins
                    </p>
                    {meeting.status === 'PROPOSED' && (
                      <p className="mt-2 rounded-xl bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700">
                        Counselor proposed a new time: {formatMeetingDateTime(meeting.proposed_time)}
                      </p>
                    )}
                    <p className="mt-1 text-xs font-semibold text-slate-400">Counselor: {meeting.counselor_name || 'Assigned counselor'}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-black ${meetingStatusStyles[meeting.status] || 'bg-slate-100 text-slate-600'}`}>
                    {meetingStatusLabels[meeting.status] || meeting.status}
                  </span>
                </div>
                {meeting.status === 'PROPOSED' && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleAcceptProposedMeeting(meeting.id)}
                      className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-black text-white hover:bg-emerald-700"
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCancelMeeting(meeting.id)}
                      className="inline-flex items-center justify-center rounded-xl border border-rose-100 bg-rose-50 px-4 py-2 text-sm font-black text-rose-700 hover:bg-rose-100"
                    >
                      Decline/Cancel
                    </button>
                  </div>
                )}
                {meeting.status === 'APPROVED' && meeting.meeting_link && (
                  <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <span className={`inline-flex rounded-xl px-3 py-2 text-sm font-black ${getMeetingCountdown(meeting) === 'Meeting is Starting Now' ? 'bg-rose-600 text-white' : 'bg-emerald-50 text-emerald-700'}`}>
                      {getMeetingCountdown(meeting)}
                    </span>
                    <a
                      href={meeting.meeting_link}
                      target="_blank"
                      rel="noreferrer"
                      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-black text-white shadow-sm ${getMeetingCountdown(meeting) === 'Meeting is Starting Now' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                    >
                      <Video size={16} />
                      Join Meeting
                    </a>
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>
      )}

      {isPendingMissingDocs && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <span className="inline-flex rounded-full bg-amber-500 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-white">
                Missing Documents
              </span>
              <h3 className="mt-3 text-xl font-black text-amber-950">Your counselor needs additional documents</h3>
              <p className="mt-2 rounded-xl border border-amber-100 bg-white px-4 py-3 text-sm font-bold leading-6 text-amber-800">
                {clientProfile?.missing_docs_note || 'Please upload the missing documents requested by your counselor.'}
              </p>
            </div>
            <form onSubmit={handleMissingDocumentsUpload} className="w-full rounded-2xl border border-amber-100 bg-white p-4 lg:max-w-md">
              <label {...getRootProps()} className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-6 text-center text-sm font-black transition ${isDragActive ? 'border-amber-500 bg-amber-100 text-amber-950' : 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'}`}>
                <Upload size={20} />
                <span className="mt-2">{missingDocsFiles.length ? `${missingDocsFiles.length} file(s) selected` : isDragActive ? 'Drop documents here' : 'Drag files here or choose missing documents'}</span>
                <input {...getInputProps()} />
              </label>
              {missingDocsUploadProgress > 0 && (
                <div className="mt-3 overflow-hidden rounded-full bg-amber-100">
                  <div className="h-2 rounded-full bg-amber-500 transition-all" style={{ width: `${missingDocsUploadProgress}%` }} />
                </div>
              )}
              {missingDocsUploadProgress === 100 && (
                <div className="mt-3 flex items-center gap-2 text-sm font-black text-emerald-700">
                  <CheckCircle2 size={17} /> Upload complete
                </div>
              )}
              {missingDocsFiles.length > 0 && (
                <div className="mt-3 space-y-1 text-xs font-bold text-slate-500">
                  {missingDocsFiles.map(file => <p key={`${file.name}-${file.size}`}>{file.name}</p>)}
                </div>
              )}
              <button
                type="submit"
                disabled={missingDocsFiles.length === 0 || isSubmittingMissingDocs}
                className="mt-4 w-full rounded-xl bg-amber-500 px-4 py-3 text-sm font-black text-white hover:bg-amber-600 disabled:opacity-50"
              >
                {isSubmittingMissingDocs ? 'Submitting...' : 'Submit Missing Documents'}
              </button>
            </form>
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-xl font-black text-slate-950">Application Progress</h3>
            <p className="mt-1 text-sm font-medium text-slate-500">Your current student application journey.</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-black ${isFinalStage ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'}`}>
            {currentStage}
          </span>
        </div>

        <div className="overflow-x-auto pb-2">
          <div className="flex min-w-[760px] items-center">
            {trackerStages.map((stage, index) => {
              const isComplete = index < currentStageIndex;
              const isActive = index === currentStageIndex;
              return (
                <div key={stage} className="flex flex-1 items-center">
                  <div className="flex flex-col items-center text-center">
                    <div className={`flex h-11 w-11 items-center justify-center rounded-full border-4 ${
                      isComplete
                        ? 'border-emerald-100 bg-emerald-500 text-white'
                        : isActive
                          ? isFinalStage
                            ? 'border-emerald-100 bg-emerald-500 text-white'
                            : 'border-blue-100 bg-blue-600 text-white'
                          : 'border-slate-100 bg-slate-100 text-slate-400'
                    }`}>
                      {isComplete || (isActive && isFinalStage) ? <CheckCircle2 size={20} /> : <span className="text-sm font-black">{index + 1}</span>}
                    </div>
                    <p className={`mt-3 max-w-28 text-xs font-black ${isActive ? isFinalStage ? 'text-emerald-700' : 'text-blue-700' : isComplete ? 'text-emerald-700' : 'text-slate-400'}`}>
                      {stage}
                    </p>
                  </div>
                  {index < trackerStages.length - 1 && (
                    <div className={`mx-3 h-1 flex-1 rounded-full ${index < currentStageIndex ? 'bg-emerald-400' : 'bg-slate-100'}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {shouldShowVisaProgress && (
          <div className={`mt-8 rounded-2xl border p-5 ${
            clientProfile?.app_status === 'VISA_COMPLETED'
              ? 'border-emerald-100 bg-emerald-50'
              : 'border-blue-100 bg-blue-50'
          }`}>
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className={`text-sm font-black ${
                  clientProfile?.app_status === 'VISA_COMPLETED' ? 'text-emerald-900' : 'text-blue-950'
                }`}>
                  {clientProfile?.app_status === 'VISA_COMPLETED'
                    ? 'Visa Processing Complete: 100%'
                    : `Visa Processing Progress: ${visaProgress}%`}
                </p>
                <p className={`mt-1 text-xs font-bold ${
                  clientProfile?.app_status === 'VISA_COMPLETED' ? 'text-emerald-700' : 'text-blue-700'
                }`}>
                  Your counselor updates this progress as your visa moves forward.
                </p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-black ${
                clientProfile?.app_status === 'VISA_COMPLETED'
                  ? 'bg-white text-emerald-700'
                  : 'bg-white text-blue-700'
              }`}>
                {clientProfile?.app_status === 'VISA_COMPLETED' ? 100 : visaProgress}%
              </span>
            </div>
            <div className={`${clientProfile?.app_status === 'VISA_COMPLETED' ? 'bg-emerald-100' : 'bg-blue-100'} h-3 overflow-hidden rounded-full`}>
              <div
                className={`${clientProfile?.app_status === 'VISA_COMPLETED' ? 'bg-emerald-600' : 'bg-blue-600'} h-full rounded-full transition-all duration-700 ease-out`}
                style={{ width: `${clientProfile?.app_status === 'VISA_COMPLETED' ? 100 : visaProgress}%` }}
              />
            </div>
          </div>
        )}

        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Target University</p>
            <p className="mt-2 font-black text-slate-900">{clientProfile?.university_name || 'Not assigned'}</p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Program/Major</p>
            <p className="mt-2 font-black text-slate-900">{clientProfile?.program_name || 'Not assigned'}</p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Destination Country</p>
            <p className="mt-2 font-black text-slate-900">{clientProfile?.study_location || clientProfile?.country_of_residence || 'Malaysia'}</p>
          </div>
        </div>
      </section>

      {hasApplication && canDownloadOffer && (
        <section className="rounded-2xl border border-emerald-100 bg-emerald-50 p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <span className="inline-flex rounded-full bg-emerald-600 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-white">
                Offer Ready
              </span>
              <h3 className="mt-3 text-xl font-black text-emerald-950">Your offer letter is ready</h3>
              <p className="mt-1 text-sm font-bold text-emerald-700">Download your approved offer letter and keep it for your next steps.</p>
            </div>
            <a
              href={clientProfile?.offer_letter_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-sm hover:bg-emerald-700"
            >
              <Download size={17} />
              Download Offer Letter
            </a>
          </div>
        </section>
      )}

      {hasApplication && canDownloadVisaDocument && (
        <section className="rounded-2xl border border-blue-100 bg-blue-50 p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <span className="inline-flex rounded-full bg-blue-600 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-white">
                Visa Processing
              </span>
              <h3 className="mt-3 text-xl font-black text-blue-950">Your visa processing document is ready</h3>
              <p className="mt-1 text-sm font-bold text-blue-700">Download the visa document uploaded by Operations.</p>
            </div>
            <a
              href={visaDocument?.file_path}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-sm hover:bg-blue-700"
            >
              <Download size={17} />
              Download Visa Document
            </a>
          </div>
        </section>
      )}

      {hasApplication && (
        <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <ClientDocumentsGrid documents={applicationDocuments} isLoading={isDocumentsLoading} />
        </section>
      )}

      {hasApplication && (
      <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <h3 className="text-xl font-black text-slate-950">Required Actions</h3>
        <div className="mt-5 space-y-3">
          {canBookFlight && (
            <form onSubmit={handleFlightBooking} className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-xl bg-blue-600 p-2 text-white">
                  <Plane size={18} />
                </div>
                <div>
                  <h4 className="font-black text-blue-950">Book Your Flight</h4>
                  <p className="text-sm font-semibold text-blue-700">Visa is complete and accommodation is ready. Upload your ticket to confirm arrival.</p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <input type="date" value={flightForm.arrival_date} onChange={event => setFlightForm(prev => ({ ...prev, arrival_date: event.target.value }))} className="rounded-xl border border-blue-100 bg-white px-3 py-2 text-sm font-semibold outline-none" required />
                <input type="time" value={flightForm.arrival_time} onChange={event => setFlightForm(prev => ({ ...prev, arrival_time: event.target.value }))} className="rounded-xl border border-blue-100 bg-white px-3 py-2 text-sm font-semibold outline-none" required />
                <input value={flightForm.terminal} onChange={event => setFlightForm(prev => ({ ...prev, terminal: event.target.value }))} placeholder="Terminal" className="rounded-xl border border-blue-100 bg-white px-3 py-2 text-sm font-semibold outline-none" required />
                <input value={flightForm.airport} onChange={event => setFlightForm(prev => ({ ...prev, airport: event.target.value }))} placeholder="Airport" className="rounded-xl border border-blue-100 bg-white px-3 py-2 text-sm font-semibold outline-none" required />
                <input value={flightForm.airlines} onChange={event => setFlightForm(prev => ({ ...prev, airlines: event.target.value }))} placeholder="Airlines" className="rounded-xl border border-blue-100 bg-white px-3 py-2 text-sm font-semibold outline-none" required />
                <input value={flightForm.trip_number} onChange={event => setFlightForm(prev => ({ ...prev, trip_number: event.target.value }))} placeholder="Trip Number" className="rounded-xl border border-blue-100 bg-white px-3 py-2 text-sm font-semibold outline-none" required />
              </div>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <label className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-blue-200 bg-white px-4 py-3 text-sm font-black text-blue-700 hover:bg-blue-50">
                  <Upload size={16} />
                  {ticketFile?.name || 'Upload ticket PDF/image'}
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden" onChange={event => setTicketFile(event.target.files?.[0] || null)} required />
                </label>
                <button disabled={!ticketFile || isSubmittingFlight} className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white hover:bg-blue-700 disabled:opacity-50">
                  {isSubmittingFlight ? 'Submitting...' : 'Submit Flight Booking'}
                </button>
              </div>
            </form>
          )}
          {pendingInvoices > 0 && (
            <div className="flex flex-col gap-4 rounded-2xl border border-amber-100 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-bold text-amber-800">You have {pendingInvoices} pending invoice{pendingInvoices > 1 ? 's' : ''} waiting for payment.</p>
              <button
                onClick={() => pendingInvoice ? setIsPaymentModalOpen(true) : navigate('/client/payments')}
                className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-black text-white hover:bg-amber-600"
              >
                Pay Invoice
              </button>
            </div>
          )}
          {missingDocuments > 0 && (
            <div className="flex flex-col gap-4 rounded-2xl border border-blue-100 bg-blue-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-bold text-blue-800">You may have {missingDocuments} missing document{missingDocuments > 1 ? 's' : ''}. Please review your profile.</p>
              <button onClick={() => navigate('/client/settings')} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-black text-white hover:bg-blue-700">
                Review Profile
              </button>
            </div>
          )}
          {hasApplication && pendingInvoices === 0 && missingDocuments === 0 && (
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">
              You are all caught up! Waiting for staff review.
            </div>
          )}
        </div>
      </section>
      )}
      <PaymentGatewayModal
        invoice={pendingInvoice}
        isOpen={isPaymentModalOpen}
        onClose={() => {
          setIsPaymentModalOpen(false);
          fetchPendingInvoice();
        }}
        onSuccess={async () => {
          await Promise.all([
            fetchClientProfile(),
            fetchClientDocuments()
          ]);
        }}
      />
      {isMeetingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black text-slate-950">Request Consultation</h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">Choose a topic and preferred meeting time.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsMeetingModalOpen(false)}
                className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleRequestMeeting} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-bold text-slate-700">Topic</label>
                <input
                  value={meetingForm.topic}
                  onChange={event => setMeetingForm(prev => ({ ...prev, topic: event.target.value }))}
                  className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-50"
                  placeholder="Visa questions, admission documents..."
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-bold text-slate-700">Preferred Date & Time</label>
                <input
                  type="datetime-local"
                  min={getDatetimeLocalMin()}
                  value={meetingForm.requested_time}
                  onChange={event => setMeetingForm(prev => ({ ...prev, requested_time: event.target.value }))}
                  className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-50"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-bold text-slate-700">Duration</label>
                <select
                  value={meetingForm.duration}
                  onChange={event => setMeetingForm(prev => ({ ...prev, duration: event.target.value }))}
                  className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-50"
                >
                  <option value="30">30 mins</option>
                  <option value="60">60 mins</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={isSubmittingMeeting}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 text-sm font-black text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
              >
                <Video size={18} />
                {isSubmittingMeeting ? 'Sending Request...' : 'Send Meeting Request'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientDashboard;
