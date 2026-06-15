import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { Users, Search, Download, Eye, Edit2, Trash2, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import Skeleton from 'react-loading-skeleton';
import { downloadCSV } from '../utils/exportUtils';
import EditClientModal from '../components/EditClientModal';
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
  Unknown: 'bg-gray-100 text-gray-500 border-gray-200'
};

const getApplicationStatusLabel = (status) => {
  if (status === 'PENDING_DOCS') return 'Pending Documents';
  if (status === 'APPLIED_FOR_OL') return 'Applied for OL';
  if (status === 'WAITING_FOR_OL') return 'Waiting for OL';
  if (['LEAD', 'PENDING_CS_REVIEW', 'COUNSELOR_ASSIGNED', 'DOCS_VERIFICATION'].includes(status)) return 'Under Review';
  if (status === 'PENDING_OFFER_APPLY') return 'Pending Operations';
  if (status === 'OFFER_PROCESSING') return 'Waiting for OL';
  if (['OFFER_UPLOADED', 'OFFER_APPROVED'].includes(status)) return 'Admission Issued';
  if (['PENDING_INVOICE_APPROVAL', 'PENDING_PAYMENT'].includes(status)) return 'Pending Payment';
  if (status === 'WAITING_PAYMENT_VERIFICATION') return 'Waiting for Payment Verification';
  if (status === 'PAYMENT_VERIFIED') return 'Paid';
  if (status === 'VISA_PROCESSING') return 'Visa Processing';
  if (['VISA_COMPLETED', 'ACCOMMODATION_READY', 'FLIGHT_BOOKED', 'ARRIVED', 'MEDICAL_CLEARED', 'COMPLETED'].includes(status)) return 'Visa Completed';
  return 'Unknown';
};

const formatDate = (dateString) => {
  if (!dateString) return 'Not recorded';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric'
  }).format(new Date(dateString));
};

const toDateInputValue = (dateString) => {
  if (!dateString) return '';
  return new Date(dateString).toISOString().slice(0, 10);
};

const ClientManagement = () => {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Filtering & Pagination State
  const [searchQuery, setSearchQuery] = useState('');
  const [counselorFilter, setCounselorFilter] = useState('All');
  const [universityFilter, setUniversityFilter] = useState('All');
  const [majorFilter, setMajorFilter] = useState('All');
  const [programFilter, setProgramFilter] = useState('All');
  const [locationFilter, setLocationFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedClient, setSelectedClient] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [searchParams] = useSearchParams();
  const openedAppRef = useRef('');
  const ITEMS_PER_PAGE = 10;

  const fetchClients = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/clients', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setClients(res.data);
      setError(null);
    } catch (err) {
      console.error('Error fetching clients:', err);
      setError('Failed to load clients. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchInitialClients = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('token');
        const res = await axios.get('/api/clients', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setClients(res.data);
        setError(null);
      } catch (err) {
        console.error('Error fetching clients:', err);
        setError('Failed to load clients. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchInitialClients();
  }, []);

  const handleDeleteClient = async (id) => {
    if (!window.confirm("Are you sure you want to delete this client? This action cannot be undone and will delete all associated applications.")) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`/api/users/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setClients(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete client.');
    }
  };

  // SLA Helpers
  const getDaysInStage = (dateString) => {
    if (!dateString) return 'N/A';
    const updatedDate = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - updatedDate);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Updated Today';
    if (diffDays === 1) return '1 day';
    return `${diffDays} days`;
  };

  const getSLAColor = (dateString) => {
    if (!dateString) return 'bg-gray-100 text-gray-500';
    const updatedDate = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - updatedDate);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 7) return 'bg-green-50 text-green-700 border-green-200';
    if (diffDays <= 14) return 'bg-yellow-50 text-yellow-700 border-yellow-200';
    return 'bg-red-50 text-red-700 font-bold border-red-200';
  };

  const rows = useMemo(() => clients.map(client => ({
    ...client,
    university: client.university_name || client.university || '',
    program: client.program_name || client.program || '',
    major: client.qualification || client.major || '',
    location: client.study_location || client.city || client.location || '',
    applicationCode: client.app_uid || `APP-${client.application_id || client.id}`,
    statusLabel: getApplicationStatusLabel(client.app_status),
    appliedDate: client.application_created_at || client.app_updated_at || ''
  })), [clients]);

  const requestedAppUid = searchParams.get('openApp');

  useEffect(() => {
    if (!requestedAppUid || rows.length === 0 || openedAppRef.current === requestedAppUid) return;

    const requested = requestedAppUid.toLowerCase();
    const match = rows.find(client => (
      String(client.applicationCode || '').toLowerCase() === requested ||
      String(client.app_uid || '').toLowerCase() === requested ||
      String(client.application_id || '').toLowerCase() === requested
    ));

    if (match) {
      openedAppRef.current = requestedAppUid;
      const timer = window.setTimeout(() => {
        setSelectedClient(match);
        setIsViewModalOpen(true);
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [requestedAppUid, rows]);

  const getOptions = (field) => [
    'All',
    ...Array.from(new Set(rows.map(row => row[field]).filter(Boolean))).sort((a, b) => String(a).localeCompare(String(b)))
  ];

  const uniqueCounselors = getOptions('assigned_counselor_name');
  const universityOptions = getOptions('university');
  const majorOptions = getOptions('major');
  const programOptions = getOptions('program');
  const locationOptions = getOptions('location');
  const statusOptions = getOptions('statusLabel');

  const resetFilters = () => {
    setSearchQuery('');
    setCounselorFilter('All');
    setUniversityFilter('All');
    setMajorFilter('All');
    setProgramFilter('All');
    setLocationFilter('All');
    setStatusFilter('All');
    setDateFromFilter('');
    setDateToFilter('');
    setCurrentPage(1);
  };

  const filteredClients = rows.filter(client => {
    const normalizedSearch = searchQuery.toLowerCase();
    const matchesSearch = (
      client.name?.toLowerCase().includes(normalizedSearch) ||
      client.email?.toLowerCase().includes(normalizedSearch) ||
      client.passport_no?.toLowerCase().includes(normalizedSearch) ||
      client.applicationCode?.toLowerCase().includes(normalizedSearch)
    );
    const equalsFilter = (value, filter) => filter === 'All' || String(value || '').toLowerCase() === String(filter).toLowerCase();
    const matchesCounselor = equalsFilter(client.assigned_counselor_name, counselorFilter);
    const matchesUniversity = equalsFilter(client.university, universityFilter);
    const matchesMajor = equalsFilter(client.major, majorFilter);
    const matchesProgram = equalsFilter(client.program, programFilter);
    const matchesLocation = equalsFilter(client.location, locationFilter);
    const matchesStatus = equalsFilter(client.statusLabel, statusFilter);
    const appliedDateValue = toDateInputValue(client.appliedDate);
    const matchesDateFrom = !dateFromFilter || (appliedDateValue && appliedDateValue >= dateFromFilter);
    const matchesDateTo = !dateToFilter || (appliedDateValue && appliedDateValue <= dateToFilter);
    return matchesSearch && matchesCounselor && matchesUniversity && matchesMajor && matchesProgram && matchesLocation && matchesStatus && matchesDateFrom && matchesDateTo;
  });

  // Pagination Logic
  const totalPages = Math.ceil(filteredClients.length / ITEMS_PER_PAGE);
  const paginatedClients = filteredClients.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800 tracking-tight">Client Management</h1>
        <p className="text-gray-500 text-sm mt-1">View and manage all registered clients, track SLAs, and oversee counselor assignments.</p>
      </div>

      {error && (
        <div className="bg-red-50 text-red-500 p-4 rounded-lg text-sm border border-red-200">
          {error}
        </div>
      )}

      {/* Advanced Search & Filters Toolbar */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="relative w-full">
             <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
             </div>
             <input 
               type="text" 
               placeholder="Search name, email, passport, app ID..." 
               value={searchQuery}
               onChange={(e) => {
                 setSearchQuery(e.target.value);
                 setCurrentPage(1);
               }}
               className="bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-lg focus:ring-agency-blue block w-full pl-10 p-2.5 outline-none transition-all"
             />
          </div>
          <select 
            value={counselorFilter}
            onChange={(e) => {
              setCounselorFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-lg focus:ring-agency-blue block w-full p-2.5 outline-none font-medium"
          >
            {uniqueCounselors.map(c => <option key={c} value={c}>{c === 'All' ? 'All Counselors' : c}</option>)}
          </select>
          <select value={universityFilter} onChange={(e) => { setUniversityFilter(e.target.value); setCurrentPage(1); }} className="bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-lg block w-full p-2.5 outline-none font-medium">
            {universityOptions.map(value => <option key={value} value={value}>{value === 'All' ? 'All Universities' : value}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }} className="bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-lg block w-full p-2.5 outline-none font-medium">
            {statusOptions.map(value => <option key={value} value={value}>{value === 'All' ? 'All Statuses' : value}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-7">
          <select value={majorFilter} onChange={(e) => { setMajorFilter(e.target.value); setCurrentPage(1); }} className="bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-lg block w-full p-2.5 outline-none font-medium">
            {majorOptions.map(value => <option key={value} value={value}>{value === 'All' ? 'All Majors' : value}</option>)}
          </select>
          <select value={programFilter} onChange={(e) => { setProgramFilter(e.target.value); setCurrentPage(1); }} className="bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-lg block w-full p-2.5 outline-none font-medium">
            {programOptions.map(value => <option key={value} value={value}>{value === 'All' ? 'All Programs' : value}</option>)}
          </select>
          <select value={locationFilter} onChange={(e) => { setLocationFilter(e.target.value); setCurrentPage(1); }} className="bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-lg block w-full p-2.5 outline-none font-medium">
            {locationOptions.map(value => <option key={value} value={value}>{value === 'All' ? 'All Locations' : value}</option>)}
          </select>
          <input type="date" value={dateFromFilter} onChange={(e) => { setDateFromFilter(e.target.value); setCurrentPage(1); }} className="bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-lg block w-full p-2.5 outline-none font-medium" aria-label="Application date from" />
          <input type="date" value={dateToFilter} onChange={(e) => { setDateToFilter(e.target.value); setCurrentPage(1); }} className="bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-lg block w-full p-2.5 outline-none font-medium" aria-label="Application date to" />
          <button type="button" onClick={resetFilters} className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-100">
            Reset Filters
          </button>
          <button 
            onClick={() => downloadCSV(filteredClients, 'client_export.csv')}
            className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-lg text-sm font-semibold shadow-sm transition-colors justify-center"
          >
            <Download size={16} />
            <span>Export Data</span>
          </button>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col min-h-[500px]">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50 text-gray-600 uppercase text-xs font-bold border-b border-gray-200">
              <tr>
                <th className="px-6 py-4">Client Details</th>
                <th className="px-6 py-4">Application ID</th>
                <th className="px-6 py-4">University / Program</th>
                <th className="px-6 py-4">Major</th>
                <th className="px-6 py-4">Date Applied</th>
                <th className="px-6 py-4">Assigned Counselor</th>
                <th className="px-6 py-4">Current Status (SLA)</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan="8" className="text-center py-12 text-gray-500">
                    <div className="space-y-3 px-4">
                      {[1, 2, 3, 4, 5].map(item => <Skeleton key={item} height={54} borderRadius={12} />)}
                    </div>
                  </td>
                </tr>
              ) : paginatedClients.length > 0 ? (
                paginatedClients.map((client) => (
                  <tr key={client.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <div className="h-10 w-10 flex-shrink-0 bg-blue-100 text-agency-blue rounded-full flex items-center justify-center font-bold shadow-sm">
                          {client.name ? client.name.charAt(0).toUpperCase() : 'U'}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900">{client.name}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{client.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-black text-blue-700">
                        {client.applicationCode}
                      </span>
                      <p className="mt-2 text-xs text-gray-500">{client.passport_no || 'No passport'}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-bold text-gray-900">{client.university}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{client.program}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-semibold text-gray-800">{client.major}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{client.location}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-semibold text-gray-800">{formatDate(client.appliedDate)}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{client.nationality || 'Unspecified'}</p>
                    </td>
                    <td className="px-6 py-4">
                      {client.assigned_counselor_name ? (
                        <span className="font-medium text-gray-800">{client.assigned_counselor_name}</span>
                      ) : (
                        <span className="px-2.5 py-1 bg-gray-100 text-gray-500 text-xs italic rounded-full border border-gray-200">Unassigned</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${statusStyles[client.statusLabel] || statusStyles.Unknown}`}>
                        {client.statusLabel}
                      </span>
                      {client.app_updated_at && (
                        <span className={`mt-2 inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] border ${getSLAColor(client.app_updated_at)}`}>
                          <Clock size={10} />
                          <span>{getDaysInStage(client.app_updated_at)}</span>
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => {
                            setSelectedClient(client);
                            setIsViewModalOpen(true);
                          }}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="View Details"
                        >
                          <Eye size={18} />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedClient(client);
                            setIsEditModalOpen(true);
                          }}
                          className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                          title="Edit Client"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button onClick={() => handleDeleteClient(client.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Delete Client">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" className="text-center py-16">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <Users className="w-12 h-12 text-gray-300" />
                      <p className="text-gray-500 font-medium text-lg">No clients found</p>
                      <p className="text-gray-400 text-sm">Adjust your filters or add a new client.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Footer */}
        <div className="bg-gray-50 border-t border-gray-200 px-6 py-4 flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Showing <span className="font-medium">{(currentPage - 1) * ITEMS_PER_PAGE + (paginatedClients.length > 0 ? 1 : 0)}</span> to <span className="font-medium">{(currentPage - 1) * ITEMS_PER_PAGE + paginatedClients.length}</span> of <span className="font-medium">{filteredClients.length}</span> entries
          </p>
          <div className="flex items-center space-x-2">
            <button 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded bg-white border border-gray-300 text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="text-sm font-medium text-gray-700 px-2">Page {currentPage} of {totalPages || 1}</span>
            <button 
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="p-1.5 rounded bg-white border border-gray-300 text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>

      {isViewModalOpen && (
        <ViewClientModal
          key={selectedClient?.id}
          clientData={selectedClient}
          isOpen={isViewModalOpen}
          onClose={() => setIsViewModalOpen(false)}
          onSuccess={fetchClients}
        />
      )}

      {isEditModalOpen && (
        <EditClientModal
          key={selectedClient?.id}
          clientData={selectedClient}
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onSuccess={fetchClients}
        />
      )}
    </div>
  );
};

export default ClientManagement;
