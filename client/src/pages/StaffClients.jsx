import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { DragDropContext, Draggable, Droppable } from '@hello-pangea/dnd';
import toast from 'react-hot-toast';
import {
  CheckCircle2,
  Clock3,
  Eye,
  FileCheck2,
  FileSearch,
  GraduationCap,
  Plus,
  RefreshCw,
  Search,
  Users,
  WalletCards
} from 'lucide-react';
import CreateApplicationModal from '../components/CreateApplicationModal';
import ViewClientModal from '../components/ViewClientModal';

const statusStyles = {
  'Under Review': 'bg-blue-50 text-blue-700 border-blue-100',
  'Pending Documents': 'bg-rose-50 text-rose-700 border-rose-100',
  'Applied for OL': 'bg-indigo-50 text-indigo-700 border-indigo-100',
  'Pending Operations': 'bg-amber-50 text-amber-700 border-amber-100',
  'Waiting for OL': 'bg-cyan-50 text-cyan-700 border-cyan-100',
  'Admission Issued': 'bg-violet-50 text-violet-700 border-violet-100',
  'Pending Payment': 'bg-amber-50 text-amber-700 border-amber-100',
  'Waiting for Payment Verification': 'bg-blue-50 text-blue-700 border-blue-100',
  Paid: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  'Visa Processing': 'bg-cyan-50 text-cyan-700 border-cyan-100',
  'Visa Completed': 'bg-emerald-50 text-emerald-700 border-emerald-100',
  Completed: 'bg-emerald-50 text-emerald-700 border-emerald-100'
};

const kanbanStatuses = [
  { id: 'PENDING_DOCS', label: 'Pending Documents' },
  { id: 'DOCS_VERIFICATION', label: 'Under Review' },
  { id: 'PENDING_OFFER_APPLY', label: 'Pending Operations' },
  { id: 'OFFER_PROCESSING', label: 'Waiting for OL' },
  { id: 'OFFER_UPLOADED', label: 'Admission Issued' },
  { id: 'OFFER_APPROVED', label: 'Admission Issued' },
  { id: 'PENDING_PAYMENT', label: 'Pending Payment' },
  { id: 'WAITING_PAYMENT_VERIFICATION', label: 'Waiting Verification' },
  { id: 'PAYMENT_VERIFIED', label: 'Paid' },
  { id: 'VISA_PROCESSING', label: 'Visa Processing' },
  { id: 'VISA_COMPLETED', label: 'Visa Completed' }
];

const getApplicationStatus = (client) => {
  if (client?.app_status === 'PENDING_DOCS') return 'Pending Documents';
  if (client?.app_status === 'APPLIED_FOR_OL') return 'Applied for OL';
  if (client?.app_status === 'WAITING_FOR_OL') return 'Waiting for OL';
  if (['LEAD', 'DOCS_VERIFICATION'].includes(client?.app_status)) return 'Under Review';
  if (client?.app_status === 'PENDING_OFFER_APPLY') return 'Pending Operations';
  if (client?.app_status === 'OFFER_PROCESSING') return 'Waiting for OL';
  if (['OFFER_UPLOADED', 'OFFER_APPROVED'].includes(client?.app_status)) return 'Admission Issued';
  if (['PENDING_INVOICE_APPROVAL', 'PENDING_PAYMENT'].includes(client?.app_status)) return 'Pending Payment';
  if (client?.app_status === 'WAITING_PAYMENT_VERIFICATION') return 'Waiting for Payment Verification';
  if (client?.app_status === 'PAYMENT_VERIFIED') return 'Paid';
  if (client?.app_status === 'VISA_PROCESSING') return 'Visa Processing';
  if (client?.app_status === 'VISA_COMPLETED') return 'Visa Completed';
  if (['ACCOMMODATION_READY', 'FLIGHT_BOOKED', 'ARRIVED', 'MEDICAL_CLEARED', 'COMPLETED'].includes(client?.app_status)) return 'Visa Completed';
  return 'Under Review';
};

const StaffClients = () => {
  const [clients, setClients] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [universityFilter, setUniversityFilter] = useState('All');
  const [assignedStaffFilter, setAssignedStaffFilter] = useState('All');
  const [majorFilter, setMajorFilter] = useState('All');
  const [programFilter, setProgramFilter] = useState('All');
  const [error, setError] = useState('');
  const [searchParams] = useSearchParams();
  const openedAppRef = useRef('');

  const fetchClients = useCallback(async ({ showLoading = true } = {}) => {
    try {
      if (showLoading) setIsLoading(true);
      setError('');
      const token = localStorage.getItem('token');
      if (!token) {
        console.error('Fetch Failed:', 'Missing auth token for StaffClients request.');
        setClients([]);
        setError('Failed to load client applications.');
        return;
      }
      const res = await axios.get('/api/clients', {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('Raw API Response:', res);
      const data = res.data?.applications || res.data?.data || res.data;
      setClients(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Fetch Failed:', err.response?.data || err.message);
      setClients([]);
      setError('Failed to load client applications.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetchClients({ showLoading: false });
    }, 0);

    return () => window.clearTimeout(timer);
  }, [fetchClients]);

  const rows = useMemo(() => (clients || []).map(client => ({
    id: client?.id,
    appUid: client?.app_uid || `APP-${client?.application_id || client?.id || 'N/A'}`,
    name: client?.name || 'Unknown Student',
    location: client?.nationality || 'Not recorded',
    university: client?.university_name || 'Not assigned',
    program: client?.program_name || 'Not assigned',
    major: client?.qualification || 'Not assigned',
    assignedStaff: client?.assigned_counselor_name || 'Unassigned',
    status: getApplicationStatus(client),
    rawStatus: client?.app_status || 'DOCS_VERIFICATION',
    clientData: client
  })), [clients]);

  const requestedAppUid = searchParams.get('openApp');

  useEffect(() => {
    if (!requestedAppUid || rows.length === 0 || openedAppRef.current === requestedAppUid) return;

    const requested = requestedAppUid.toLowerCase();
    const match = rows.find(row => (
      String(row.appUid || '').toLowerCase() === requested ||
      String(row.clientData?.app_uid || '').toLowerCase() === requested ||
      String(row.clientData?.application_id || '').toLowerCase() === requested
    ));

    if (match) {
      openedAppRef.current = requestedAppUid;
      const timer = window.setTimeout(() => {
        setSelectedClient(match.clientData);
        setIsViewModalOpen(true);
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [requestedAppUid, rows]);

  const getFilterOptions = (field) => [
    ...new Set(rows.map(row => row[field]).filter(Boolean))
  ].sort((a, b) => a.localeCompare(b));

  const universityOptions = getFilterOptions('university');
  const assignedStaffOptions = getFilterOptions('assignedStaff');
  const statusOptions = getFilterOptions('status');
  const majorOptions = getFilterOptions('major');
  const programOptions = getFilterOptions('program');

  const filteredRows = rows.filter(row => {
    const normalizedSearch = searchTerm.toLowerCase();
    const matchesSearch = (
      row.name.toLowerCase().includes(normalizedSearch) ||
      row.appUid.toLowerCase().includes(normalizedSearch)
    );
    const matchesStatus = statusFilter === 'All' || row.status === statusFilter;
    const matchesUniversity = universityFilter === 'All' || row.university === universityFilter;
    const matchesAssignedStaff = assignedStaffFilter === 'All' || row.assignedStaff === assignedStaffFilter;
    const matchesMajor = majorFilter === 'All' || row.major === majorFilter;
    const matchesProgram = programFilter === 'All' || row.program === programFilter;
    return matchesSearch && matchesStatus && matchesUniversity && matchesAssignedStaff && matchesMajor && matchesProgram;
  });

  const statusCount = (status) => rows.filter(row => row.status === status).length;

  const kanbanRows = useMemo(() => kanbanStatuses.map(status => ({
    ...status,
    items: rows.filter(row => row.rawStatus === status.id)
  })), [rows]);

  const handleKanbanDragEnd = async (result) => {
    const { destination, source, draggableId } = result;
    if (!destination || destination.droppableId === source.droppableId) return;

    const applicationId = Number(draggableId.replace('app-', ''));
    const nextStatus = destination.droppableId;
    const previousClients = clients;

    setClients(prev => prev.map(client => (
      Number(client.application_id) === applicationId
        ? { ...client, app_status: nextStatus }
        : client
    )));

    try {
      const token = localStorage.getItem('token');
      await axios.put(`/api/applications/${applicationId}/advance-state`, { new_status: nextStatus }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Application status updated.');
      await fetchClients({ showLoading: false });
    } catch (err) {
      setClients(previousClients);
      toast.error(err.response?.data?.message || 'Could not update application status.');
    }
  };

  const pipelineCards = [
    { label: 'Total Applications', value: String(rows.length), icon: Users, accent: 'bg-blue-50 text-blue-600 border-blue-100' },
    { label: 'Under Review', value: String(statusCount('Under Review')), icon: FileSearch, accent: 'bg-indigo-50 text-indigo-600 border-indigo-100' },
    { label: 'Admission Issued', value: String(statusCount('Admission Issued')), icon: FileCheck2, accent: 'bg-violet-50 text-violet-600 border-violet-100' },
    { label: 'Pending Payment', value: String(statusCount('Pending Payment')), icon: WalletCards, accent: 'bg-amber-50 text-amber-600 border-amber-100' },
    { label: 'Visa Processing', value: String(statusCount('Visa Processing')), icon: Clock3, accent: 'bg-cyan-50 text-cyan-600 border-cyan-100' },
    { label: 'Visa Completed', value: String(statusCount('Visa Completed')), icon: CheckCircle2, accent: 'bg-emerald-50 text-emerald-600 border-emerald-100' }
  ];

  return (
    <div className="space-y-6 bg-slate-50" dir="ltr">
      <div>
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-slate-400">Client Applications</p>
        <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Application Pipeline</h2>
      </div>

      <section className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {pipelineCards.map(card => {
          const Icon = card.icon;
          return (
            <article key={card.label} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <div className={`mb-4 inline-flex rounded-xl border p-2.5 ${card.accent}`}>
                <Icon size={19} />
              </div>
              <p className="text-3xl font-black text-slate-950">{card.value}</p>
              <p className="mt-2 text-xs font-bold leading-5 text-slate-500">{card.label}</p>
            </article>
          );
        })}
      </section>

      <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
            <div className="relative w-full md:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by name..."
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-indigo-300 focus:bg-white focus:ring-4 focus:ring-indigo-50 xl:col-span-1"
              />
            </div>

            <select
              value={universityFilter}
              onChange={(event) => setUniversityFilter(event.target.value)}
              className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-600 outline-none transition focus:border-indigo-300 focus:bg-white focus:ring-4 focus:ring-indigo-50"
            >
              <option value="All">All Universities</option>
              {universityOptions.map(university => (
                <option key={university} value={university}>{university}</option>
              ))}
            </select>

            <select
              value={assignedStaffFilter}
              onChange={(event) => setAssignedStaffFilter(event.target.value)}
              className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-600 outline-none transition focus:border-indigo-300 focus:bg-white focus:ring-4 focus:ring-indigo-50"
            >
              <option value="All">All Assigned Staff</option>
              {assignedStaffOptions.map(staff => (
                <option key={staff} value={staff}>{staff}</option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-600 outline-none transition focus:border-indigo-300 focus:bg-white focus:ring-4 focus:ring-indigo-50"
            >
              <option value="All">All Statuses</option>
              {statusOptions.map(status => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>

            <select
              value={majorFilter}
              onChange={(event) => setMajorFilter(event.target.value)}
              className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-600 outline-none transition focus:border-indigo-300 focus:bg-white focus:ring-4 focus:ring-indigo-50"
            >
              <option value="All">All Majors</option>
              {majorOptions.map(major => (
                <option key={major} value={major}>{major}</option>
              ))}
            </select>

            <select
              value={programFilter}
              onChange={(event) => setProgramFilter(event.target.value)}
              className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-600 outline-none transition focus:border-indigo-300 focus:bg-white focus:ring-4 focus:ring-indigo-50"
            >
              <option value="All">All Programs</option>
              {programOptions.map(program => (
                <option key={program} value={program}>{program}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => fetchClients()}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-4 text-sm font-black text-slate-600 transition hover:bg-slate-200"
            >
              <RefreshCw size={16} />
              Refresh List
            </button>
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-black text-white shadow-sm shadow-emerald-100 transition hover:bg-emerald-700"
            >
              <Plus size={17} />
              New Application
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-black text-slate-950">Operations Kanban</h3>
            <p className="mt-1 text-sm font-medium text-slate-500">Drag cards between stages to update the application status.</p>
          </div>
        </div>
        <DragDropContext onDragEnd={handleKanbanDragEnd}>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {kanbanRows.map(column => (
              <Droppable droppableId={column.id} key={column.id}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`min-h-52 w-64 shrink-0 rounded-2xl border p-3 transition ${snapshot.isDraggingOver ? 'border-blue-200 bg-blue-50' : 'border-slate-100 bg-slate-50'}`}
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">{column.label}</p>
                      <span className="rounded-full bg-white px-2 py-0.5 text-xs font-black text-slate-500">{column.items.length}</span>
                    </div>
                    {column.items.map((item, index) => (
                      <Draggable draggableId={`app-${item.clientData.application_id}`} index={index} key={`app-${item.clientData.application_id}`}>
                        {(dragProvided, dragSnapshot) => (
                          <div
                            ref={dragProvided.innerRef}
                            {...dragProvided.draggableProps}
                            {...dragProvided.dragHandleProps}
                            className={`mb-2 rounded-xl border bg-white p-3 shadow-sm transition ${dragSnapshot.isDragging ? 'rotate-1 border-blue-200 shadow-lg' : 'border-slate-100'}`}
                          >
                            <p className="text-sm font-black text-slate-900">{item.name}</p>
                            <p className="mt-1 text-xs font-bold text-blue-700">{item.appUid}</p>
                            <p className="mt-1 truncate text-xs font-semibold text-slate-500">{item.university}</p>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            ))}
          </div>
        </DragDropContext>
      </section>

      {error && (
        <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
          {error}
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="text-lg font-black text-slate-950">Student Applications</h3>
            <p className="mt-1 text-sm font-medium text-slate-500">A focused staff view of active student records.</p>
          </div>
          <div className="hidden rounded-xl bg-slate-50 p-2 text-slate-400 sm:block">
            <GraduationCap size={20} />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-black uppercase tracking-[0.12em] text-slate-400">
              <tr>
                <th className="px-5 py-4">Student Name & Location</th>
                <th className="px-5 py-4">Application ID</th>
                <th className="px-5 py-4">Assigned Staff</th>
                <th className="px-5 py-4">University</th>
                <th className="px-5 py-4">Major/Program</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan="7" className="px-5 py-10 text-center text-sm font-bold text-slate-500">Loading applications...</td>
                </tr>
              ) : filteredRows.length > 0 ? (
                filteredRows.map(student => (
                  <tr key={student.id} className="transition hover:bg-slate-50/70">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-sm font-black text-indigo-700">
                          {student.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-black text-slate-950">{student.name}</p>
                          <p className="mt-0.5 text-xs font-semibold text-slate-400">{student.location}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="rounded-xl bg-blue-50 px-3 py-1.5 text-xs font-black text-blue-700">
                        {student.appUid}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`rounded-xl px-3 py-1.5 text-xs font-black ${student.assignedStaff === 'Unassigned' ? 'bg-slate-100 text-slate-500' : 'bg-emerald-50 text-emerald-700'}`}>
                        {student.assignedStaff}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-bold text-slate-700">{student.university}</td>
                    <td className="px-5 py-4">
                      <p className="font-bold text-slate-700">{student.major}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-400">{student.program}</p>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${statusStyles[student.status] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                        {student.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedClient(student.clientData);
                          setIsViewModalOpen(true);
                        }}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-indigo-100 hover:bg-indigo-50 hover:text-indigo-600"
                        aria-label={`View ${student.name}`}
                      >
                        <Eye size={17} />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="px-5 py-12 text-center">
                    <p className="font-black text-slate-700">No applications found.</p>
                    <p className="mt-1 text-sm font-medium text-slate-500">Adjust the filters or create a new application to start the pipeline.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <CreateApplicationModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={fetchClients}
      />
      {isViewModalOpen && (
        <ViewClientModal
          key={`${selectedClient?.id || 'client'}-${selectedClient?.application_id || selectedClient?.app_uid || 'application'}-${selectedClient?.app_status || selectedClient?.status || 'status'}`}
          isOpen={isViewModalOpen}
          onClose={() => setIsViewModalOpen(false)}
          clientData={selectedClient}
          onSuccess={fetchClients}
        />
      )}
    </div>
  );
};

export default StaffClients;
