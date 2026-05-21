import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Users, UserCheck, UserMinus, UserCog, UserPlus, 
  Plus, Download, Search, FilterX, Eye, Edit2, Star, Trash2 
} from 'lucide-react';
import { downloadCSV } from '../utils/exportUtils';
import AddStaffModal from '../components/AddStaffModal';

const TABS = ['All Staff', 'Active', 'On Leave', 'Probation', 'New'];
const STAFF_DEPARTMENTS = ['Customer Service', 'Counselor', 'Finance', 'Operations'];
const STAFF_JOB_TITLES = ['Customer Service Officer', 'Junior Counselor', 'Senior Counselor', 'Accountant', 'Operations Officer'];

const getPerformanceLabel = (score) => {
  const value = Number(score || 0);
  if (value >= 80) return 'Top Performer';
  if (value >= 50) return 'Solid';
  if (value > 0) return 'Needs Improvement';
  return 'No Tasks';
};

const StaffManagement = () => {
  const [activeTab, setActiveTab] = useState('All Staff');
  const [staffData, setStaffData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('All');
  const [jobTitleFilter, setJobTitleFilter] = useState('All');
  const [performanceFilter, setPerformanceFilter] = useState('All');

  const fetchStaff = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/users/staff', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const mappedData = res.data.map(staff => ({
        ...staff,
        name: staff.full_name || 'Unknown',
        title: staff.job_title || 'Staff',
        performance_score: Number(staff.performance_score || 0),
        total_tasks: Number(staff.total_tasks || 0),
        completed_tasks: Number(staff.completed_tasks || 0)
      }));
      setStaffData(mappedData);
    } catch (err) {
      console.error('Error fetching staff data', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteStaff = async (id) => {
    if (!window.confirm("Are you sure you want to delete this staff member? This action cannot be undone.")) return;
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      await axios.delete(`/api/users/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStaffData(prev => prev.filter(staff => staff.id !== id));
    } catch (err) {
      console.error('Error deleting staff', err);
      alert(err.response?.data?.message || 'Failed to delete staff member.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchInitialStaff = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('token');
        const res = await axios.get('/api/users/staff', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const mappedData = res.data.map(staff => ({
          ...staff,
          name: staff.full_name || 'Unknown',
          title: staff.job_title || 'Staff',
          performance_score: Number(staff.performance_score || 0),
          total_tasks: Number(staff.total_tasks || 0),
          completed_tasks: Number(staff.completed_tasks || 0)
        }));
        setStaffData(mappedData);
      } catch (err) {
        console.error('Error fetching staff data', err);
      } finally {
        setLoading(false);
      }
    };

    fetchInitialStaff();
  }, []);

  const totalStaff = staffData.length;
  const activeStaff = staffData.filter(s => s.status === 'Active').length;
  const onLeaveStaff = staffData.filter(s => s.status === 'On Leave').length;
  const probationStaff = staffData.filter(s => s.status === 'Probation').length;
  const newStaff = staffData.filter(s => s.status === 'New').length;

  const KPI_STATS = [
    { title: 'Total Staff', count: totalStaff, icon: <Users className="w-5 h-5 text-blue-600" />, border: 'border-blue-500', bg: 'bg-blue-50' },
    { title: 'Active', count: activeStaff, icon: <UserCheck className="w-5 h-5 text-green-600" />, border: 'border-green-500', bg: 'bg-green-50' },
    { title: 'On Leave', count: onLeaveStaff, icon: <UserMinus className="w-5 h-5 text-orange-600" />, border: 'border-orange-500', bg: 'bg-orange-50' },
    { title: 'Probation', count: probationStaff, icon: <UserCog className="w-5 h-5 text-yellow-600" />, border: 'border-yellow-500', bg: 'bg-yellow-50' },
    { title: 'New Staff', count: newStaff, icon: <UserPlus className="w-5 h-5 text-purple-600" />, border: 'border-purple-500', bg: 'bg-purple-50' },
  ];

  const filteredStaff = staffData.filter(staff => {
    const haystack = [
      staff.name,
      staff.full_name,
      staff.email,
      staff.department,
      staff.job_title,
      staff.title
    ].join(' ').toLowerCase();
    const matchesSearch = haystack.includes(searchTerm.trim().toLowerCase());
    const matchesTab = activeTab === 'All Staff' || staff.status === activeTab;
    const matchesDepartment = departmentFilter === 'All' || staff.department === departmentFilter;
    const matchesJobTitle = jobTitleFilter === 'All' || staff.job_title === jobTitleFilter || staff.title === jobTitleFilter;
    const score = Number(staff.performance_score || 0);
    const matchesPerformance =
      performanceFilter === 'All' ||
      (performanceFilter === 'Top Performers' && score > 80) ||
      (performanceFilter === 'Needs Improvement' && score < 50) ||
      (performanceFilter === 'No Tasks' && Number(staff.total_tasks || 0) === 0);

    return matchesSearch && matchesTab && matchesDepartment && matchesJobTitle && matchesPerformance;
  });

  const departments = [...new Set(staffData.map(staff => staff.department).filter(department => STAFF_DEPARTMENTS.includes(department)))];
  const jobTitles = [...new Set(staffData.map(staff => staff.job_title || staff.title).filter(title => STAFF_JOB_TITLES.includes(title)))];

  const handleToggleStar = async (staffId) => {
    setStaffData(prev => prev.map(staff => (
      staff.id === staffId ? { ...staff, is_starred: !staff.is_starred } : staff
    )));

    try {
      const token = localStorage.getItem('token');
      const res = await axios.put(`/api/staff/${staffId}/star`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStaffData(prev => prev.map(staff => (
        staff.id === staffId ? { ...staff, is_starred: res.data.is_starred } : staff
      )));
    } catch (err) {
      console.error('Error toggling staff star', err);
      setStaffData(prev => prev.map(staff => (
        staff.id === staffId ? { ...staff, is_starred: !staff.is_starred } : staff
      )));
      alert(err.response?.data?.message || 'Failed to update starred staff.');
    }
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setDepartmentFilter('All');
    setJobTitleFilter('All');
    setPerformanceFilter('All');
  };

  // Status Badge Helper
  const getStatusBadge = (status) => {
    switch (status) {
      case 'Active': return <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border border-green-200">Active</span>;
      case 'Probation': return <span className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border border-yellow-200">Probation</span>;
      case 'On Leave': return <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border border-orange-200">On Leave</span>;
      case 'New': return <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border border-purple-200">New</span>;
      default: return <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Title Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800 tracking-tight">Staff Management</h1>
        <p className="text-gray-500 text-sm mt-1">Manage employee records, verify probation statuses, and track department performance grids.</p>
      </div>

      {/* 1. KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {KPI_STATS.map((stat, idx) => (
          <div key={idx} className={`bg-white rounded-xl shadow-sm border border-gray-100 p-4 border-t-4 ${stat.border} flex items-center justify-between`}>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{stat.title}</p>
              <h3 className="text-2xl font-bold text-gray-800 mt-1">{stat.count}</h3>
            </div>
            <div className={`p-2.5 rounded-lg ${stat.bg}`}>
              {stat.icon}
            </div>
          </div>
        ))}
      </div>

      {/* 2. Quick Actions & Quick Tabs */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0 border-b border-gray-200 pb-2">
        {/* Horizontal Navigation Tabs */}
        <div className="flex space-x-6 overflow-x-auto w-full md:w-auto scrollbar-hide">
          {TABS.map(tab => (
            <button 
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 text-sm font-semibold transition-colors border-b-2 whitespace-nowrap ${
                activeTab === tab 
                  ? 'border-agency-blue text-agency-blue' 
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center space-x-3 w-full md:w-auto">
          <button onClick={() => downloadCSV(staffData, 'staff_export.csv')} className="flex items-center justify-center space-x-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-sm transition-colors w-full md:w-auto">
            <Download size={16} />
            <span>Export Excel</span>
          </button>
          <button onClick={() => setIsAddModalOpen(true)} className="flex items-center justify-center space-x-2 bg-agency-blue hover:bg-agency-lightBlue text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-sm transition-colors w-full md:w-auto">
            <Plus size={16} />
            <span>Add Staff</span>
          </button>
        </div>
      </div>

      {/* 3. Advanced Search & Filters Toolbar */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
         <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
            
            {/* Search Input */}
            <div className="col-span-1 md:col-span-4 relative">
               <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-gray-400" />
               </div>
               <input 
                 type="text" 
                 value={searchTerm}
                 onChange={(event) => setSearchTerm(event.target.value)}
                 placeholder="Search name, email, department..." 
                 className="bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-lg focus:ring-agency-blue block w-full pl-10 p-2.5 outline-none transition-all"
               />
            </div>

            {/* Dropdowns */}
            <div className="col-span-1 md:col-span-2">
               <select value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)} className="bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-lg focus:ring-agency-blue block w-full p-2.5 outline-none font-medium appearance-none">
                  <option value="All">Department: All</option>
                  {departments.map(department => (
                    <option key={department} value={department}>{department}</option>
                  ))}
               </select>
            </div>
            <div className="col-span-1 md:col-span-2">
               <select value={jobTitleFilter} onChange={(event) => setJobTitleFilter(event.target.value)} className="bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-lg focus:ring-agency-blue block w-full p-2.5 outline-none font-medium appearance-none">
                  <option value="All">Job Title: All</option>
                  {jobTitles.map(title => (
                    <option key={title} value={title}>{title}</option>
                  ))}
               </select>
            </div>
            <div className="col-span-1 md:col-span-2">
               <select value={performanceFilter} onChange={(event) => setPerformanceFilter(event.target.value)} className="bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-lg focus:ring-agency-blue block w-full p-2.5 outline-none font-medium appearance-none">
                  <option value="All">Performance: All</option>
                  <option>Top Performers</option>
                  <option>Needs Improvement</option>
                  <option>No Tasks</option>
               </select>
            </div>

            <div className="col-span-1 md:col-span-2 flex justify-end space-x-2">
               <button type="button" onClick={handleClearFilters} className="flex items-center space-x-1.5 text-red-500 hover:bg-red-50 px-3 py-2 rounded-lg text-sm font-semibold transition-colors">
                 <FilterX size={16} />
                 <span>Clear</span>
               </button>
            </div>
         </div>
      </div>

      {/* 4. Staff Data Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto p-4 min-h-[500px]">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-100 text-gray-600 uppercase text-xs font-semibold">
              <tr>
                <th className="px-5 py-4 rounded-l-lg">Staff Member</th>
                <th className="px-5 py-4">Department</th>
                <th className="px-5 py-4">Job Title</th>
                <th className="px-5 py-4 text-center">Status</th>
                <th className="px-5 py-4">Performance</th>
                <th className="px-5 py-4">Hire Date</th>
                <th className="px-5 py-4 text-right rounded-r-lg">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 border-t border-gray-100">
              {loading ? (
                <tr><td colSpan="7" className="text-center py-8 text-gray-500 bg-gray-50">Loading staff members...</td></tr>
              ) : filteredStaff.length > 0 ? filteredStaff.map((staff, idx) => (
                <tr key={idx} className="hover:bg-gray-50/80 transition-colors">
                   
                   {/* Avatar + Name Column */}
                   <td className="px-5 py-4 flex items-center space-x-3">
                      <div className="h-10 w-10 flex-shrink-0 bg-agency-blue rounded-full flex items-center justify-center text-white font-bold shadow-inner">
                         {staff.name.charAt(0)}
                      </div>
                      <div>
                         <p className="font-bold text-gray-900">{staff.name}</p>
                         <p className="text-xs text-gray-500">{staff.email}</p>
                      </div>
                   </td>
                   
                   <td className="px-5 py-4 font-semibold text-gray-700">{staff.department}</td>
                   <td className="px-5 py-4 text-gray-600">{staff.title}</td>
                   
                   <td className="px-5 py-4 text-center">
                      {getStatusBadge(staff.status)}
                   </td>
                   
                   <td className="px-5 py-4">
                      <div className="min-w-[150px]">
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className={`${
                            staff.performance_score >= 80 ? 'text-green-600' :
                            staff.performance_score >= 50 ? 'text-blue-600' :
                            staff.performance_score > 0 ? 'text-orange-500' : 'text-gray-400'
                          }`}>
                            {getPerformanceLabel(staff.performance_score)}
                          </span>
                          <span className="text-gray-500">{staff.performance_score}%</span>
                        </div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100">
                          <div
                            className={`h-full rounded-full ${
                              staff.performance_score >= 80 ? 'bg-green-500' :
                              staff.performance_score >= 50 ? 'bg-blue-500' :
                              staff.performance_score > 0 ? 'bg-orange-400' : 'bg-gray-300'
                            }`}
                            style={{ width: `${Math.min(staff.performance_score, 100)}%` }}
                          />
                        </div>
                        <p className="mt-1 text-[11px] font-semibold text-gray-400">{staff.completed_tasks}/{staff.total_tasks} tasks completed</p>
                      </div>
                   </td>
                   
                   <td className="px-5 py-4 text-gray-500 font-mono text-xs">
                      {staff.hireDate}
                   </td>
                   
                   <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                         <button onClick={() => setSelectedStaff(staff)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="View Profile">
                           <Eye size={18} />
                         </button>
                         <button onClick={() => { setEditingStaff(staff); setIsAddModalOpen(true); }} className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors" title="Edit Record">
                           <Edit2 size={18} />
                         </button>
                         <button onClick={() => handleToggleStar(staff.id)} className={`p-1.5 rounded transition-colors ${staff.is_starred ? 'text-yellow-500 bg-yellow-50' : 'text-gray-400 hover:text-yellow-500 hover:bg-yellow-50'}`} title="Highlight Staff">
                           <Star size={18} fill={staff.is_starred ? 'currentColor' : 'none'} />
                         </button>
                         <button onClick={() => handleDeleteStaff(staff.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Delete Record">
                           <Trash2 size={18} />
                         </button>
                      </div>
                   </td>
                </tr>
              )) : (
                <tr><td colSpan="7" className="text-center py-8 text-gray-500 bg-gray-50">No staff members found. Add a staff member to see them listed here.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isAddModalOpen && (
        <AddStaffModal
          key={editingStaff?.id || 'new-staff'}
          isOpen={isAddModalOpen}
          onClose={() => {
            setIsAddModalOpen(false);
            setEditingStaff(null);
          }}
          onSuccess={fetchStaff}
          staffToEdit={editingStaff}
        />
      )}

      {selectedStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-xl rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between border-b border-gray-100 pb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Staff Details</h2>
                <p className="mt-1 text-sm text-gray-500">Full employee profile and task performance.</p>
              </div>
              <button onClick={() => setSelectedStaff(null)} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
                x
              </button>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
              {[
                ['Name', selectedStaff.name],
                ['Email', selectedStaff.email],
                ['Role', selectedStaff.role || 'staff'],
                ['Department', selectedStaff.department],
                ['Job Title', selectedStaff.job_title || selectedStaff.title],
                ['Phone', selectedStaff.phone || 'Not recorded'],
                ['Joined Date', selectedStaff.hireDate || 'Not recorded'],
                ['Total Tasks Assigned', selectedStaff.total_tasks],
                ['Completed Tasks', selectedStaff.completed_tasks],
                ['Performance Score', `${selectedStaff.performance_score}%`]
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-400">{label}</p>
                  <p className="mt-1 font-bold text-gray-800">{value}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 flex justify-end">
              <button onClick={() => setSelectedStaff(null)} className="rounded-lg bg-agency-blue px-5 py-2.5 text-sm font-semibold text-white hover:bg-agency-lightBlue">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default StaffManagement;
