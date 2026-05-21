import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ShieldCheck, LayoutDashboard, Users, Briefcase, CheckSquare, CreditCard, LogOut, Search, Bell, User, Target, WalletCards } from 'lucide-react';

const AdminLayout = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user') || '{}'));
  const [notifications, setNotifications] = useState([]);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  useEffect(() => {
    const syncUser = () => setUser(JSON.parse(localStorage.getItem('user') || '{}'));
    window.addEventListener('userUpdated', syncUser);
    window.addEventListener('storage', syncUser);
    return () => {
      window.removeEventListener('userUpdated', syncUser);
      window.removeEventListener('storage', syncUser);
    };
  }, []);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get('/api/admin/notifications', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setNotifications(Array.isArray(res.data) ? res.data : []);
      } catch (error) {
        console.error('Failed to fetch admin notifications:', error);
        setNotifications([]);
      }
    };

    const timer = window.setTimeout(fetchNotifications, 0);
    const interval = window.setInterval(fetchNotifications, 15000);

    return () => {
      window.clearTimeout(timer);
      window.clearInterval(interval);
    };
  }, []);

  const getNotificationTarget = (notification) => {
    if (notification.target_url) return notification.target_url;
    const type = String(notification.type || '').toLowerCase();
    const message = String(notification.message || '').toLowerCase();

    if (type.includes('invoice') || message.includes('invoice') || message.includes('payment')) return '/admin/finance';
    if (type.includes('message') || type.includes('chat') || message.includes('message')) return '/staff/messages';
    if (notification.app_uid) return `/admin/clients?openApp=${encodeURIComponent(notification.app_uid)}`;
    if (type.includes('document') || type.includes('offer') || type.includes('application')) return '/admin/clients';
    return '/admin';
  };

  const handleNotificationClick = async (notification) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`/api/notifications/${notification.id}/read`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(prev => prev.filter(item => item.id !== notification.id));
      setIsNotificationsOpen(false);
      navigate(getNotificationTarget(notification));
    } catch (error) {
      console.error('Failed to mark admin notification as read:', error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const navItems = [
    { name: 'Dashboard', path: '/admin', icon: <LayoutDashboard size={20} /> },
    { name: 'Clients Management', path: '/admin/clients', icon: <Users size={20} /> },
    { name: 'Staff Management', path: '/admin/staff', icon: <Briefcase size={20} /> },
    { name: 'Task Management', path: '/admin/tasks', icon: <CheckSquare size={20} /> },
    { name: 'Payments', path: '/admin/payments', icon: <CreditCard size={20} /> },
    { name: 'Finance', path: '/admin/finance', icon: <WalletCards size={20} /> },
    { name: 'Goals & Missions', path: '/admin/goals', icon: <Target size={20} /> },
    { name: 'Profile Settings', path: '/settings/profile', icon: <User size={20} /> },
  ];

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden font-sans">
      
      {/* Sidebar - LTR Fixed Column */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col justify-between hidden md:flex shadow-sm z-20">
        <div>
          {/* Logo Brand */}
          <div className="py-6 px-6 border-b border-gray-100 bg-white flex justify-center">
             <img src="/logo.png" alt="Tasheer Agency Logo" className="h-32 w-auto object-contain" />
          </div>
          
          {/* Navigation Links */}
          <nav className="p-4 space-y-1.5 mt-2">
            <div className="px-3 mb-2">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Main Menu</p>
            </div>
            {navItems.map((item) => (
              <NavLink 
                key={item.name}
                to={item.path}
                end={item.path === '/admin'}
                className={({ isActive }) => 
                  `flex items-center space-x-3 px-4 py-2.5 rounded-full transition-all duration-200 ${
                    isActive 
                      ? 'bg-agency-blue text-white shadow-md shadow-blue-200 font-semibold mb-2' 
                      : 'text-gray-600 hover:bg-gray-100 font-medium'
                  }`
                }
              >
                {item.icon}
                <span className="text-sm">{item.name}</span>
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Global Nav Settings */}
        <div className="p-4 border-t border-gray-100">
          <button onClick={handleLogout} className="flex items-center w-full space-x-3 text-gray-500 hover:text-red-500 px-4 py-2.5 rounded-full hover:bg-red-50 transition-colors">
            <LogOut size={20} />
            <span className="text-sm font-semibold">Log Out</span>
          </button>
        </div>
      </aside>

      {/* Main Right Content Environment */}
      <main className="flex-1 flex flex-col relative min-w-0 overflow-y-auto">
        
        {/* Dynamic Top Header */}
        <header className="h-16 bg-white border-b border-gray-200 sticky top-0 flex items-center justify-between px-6 z-10 shadow-sm">
           
           {/* Left Header - Search Mechanism */}
           <div className="flex items-center space-x-4 flex-1">
              <div className="relative w-full max-w-sm hidden md:block">
                 <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-gray-400" />
                 </div>
                 <input type="text" className="bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-full focus:ring-agency-blue focus:border-agency-blue block w-full pl-10 p-2 outline-none transition-all" placeholder="Search accounts, records..." />
              </div>
           </div>

           {/* Right Header - User Block */}
           <div className="flex items-center space-x-5">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsNotificationsOpen(prev => !prev)}
                  className="relative text-gray-400 hover:text-agency-blue"
                  aria-label="Open admin notifications"
                >
                   <Bell className="w-5 h-5" />
                   {notifications.length > 0 && (
                     <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-black text-white ring-2 ring-white">
                       {notifications.length}
                     </span>
                   )}
                </button>

                {isNotificationsOpen && (
                  <div className="absolute right-0 mt-3 w-80 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl">
                    <div className="border-b border-gray-100 px-4 py-3">
                      <p className="text-sm font-black text-gray-900">Notifications</p>
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <p className="px-4 py-5 text-sm text-gray-500">No unread notifications.</p>
                      ) : (
                        notifications.map(notification => (
                          <button
                            key={notification.id}
                            type="button"
                            onClick={() => handleNotificationClick(notification)}
                            className="block w-full border-b border-gray-50 px-4 py-3 text-left hover:bg-gray-50"
                          >
                            <p className="text-sm font-semibold text-gray-800">{notification.message}</p>
                            <p className="mt-1 text-xs text-gray-400">Open and mark as read</p>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="flex items-center space-x-3 border-l pl-5 border-gray-200">
                <div className="hidden md:flex flex-col text-right">
                  <span className="text-sm font-bold text-gray-800">{user.full_name || 'Adminstrator'}</span>
                  <span className="text-xs text-gray-500 uppercase font-semibold tracking-wider">{user.job_title || user.department || 'Admin'}</span>
                </div>
                {/* Avatar Initial Block */}
                {user.profile_image_url ? (
                  <img src={user.profile_image_url} alt="Profile" className="h-9 w-9 rounded-full object-cover shadow-inner shadow-blue-900" />
                ) : (
                  <div className="h-9 w-9 rounded-full bg-agency-blue flex items-center justify-center text-white font-bold text-sm shadow-inner shadow-blue-900">
                     {user.full_name ? user.full_name.charAt(0).toUpperCase() : 'A'}
                  </div>
                )}
              </div>
           </div>
        </header>

        {/* Dynamic Outlet Router View */}
        <div className="p-6 md:p-8 bg-gray-50/50 flex-1">
           <Outlet />
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
