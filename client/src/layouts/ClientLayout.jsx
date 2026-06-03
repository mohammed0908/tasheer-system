import { useEffect, useState } from 'react';
import axios from 'axios';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Bell,
  ChevronDown,
  CreditCard,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  User
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', path: '/client', icon: LayoutDashboard },
  { name: 'Chat with Staff', path: '/client/chat', icon: MessageSquare },
  { name: 'Payments', path: '/client/payments', icon: CreditCard },
  { name: 'Profile Settings', path: '/client/settings', icon: User }
];

const ClientLayout = () => {
  const [notifications, setNotifications] = useState([]);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user') || '{}'));
  const navigate = useNavigate();

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
    const timer = window.setTimeout(async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get('/api/notifications/unread', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setNotifications(Array.isArray(res.data) ? res.data : []);
      } catch (error) {
        console.error('Failed to fetch client notifications:', error);
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const fetchUnreadMessages = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get('/api/messages/unread-count', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setUnreadMessagesCount(Number(res.data?.count || 0));
      } catch (error) {
        console.error('Failed to fetch unread client messages:', error);
      }
    };

    const timer = window.setTimeout(fetchUnreadMessages, 0);
    const interval = window.setInterval(fetchUnreadMessages, 10000);

    return () => {
      window.clearTimeout(timer);
      window.clearInterval(interval);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const markNotificationRead = async (id) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`/api/notifications/${id}/read`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(prev => prev.filter(notification => notification.id !== id));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const getNotificationTarget = (notification) => {
    const type = String(notification?.type || '').toLowerCase();
    const message = String(notification?.message || '').toLowerCase();
    if (notification?.target_url) return notification.target_url;
    if (type.includes('invoice') || type.includes('payment') || message.includes('invoice') || message.includes('payment')) return '/client/payments';
    if (type.includes('chat') || type.includes('message') || message.includes('message')) return '/client/chat';
    return '/client';
  };

  const handleNotificationClick = async (notification) => {
    const target = getNotificationTarget(notification);
    await markNotificationRead(notification.id);
    setIsNotificationsOpen(false);
    navigate(target);
    if (target.includes('#')) {
      const hash = target.split('#')[1];
      window.setTimeout(() => {
        document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 150);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900" dir="ltr">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-slate-200 bg-white px-5 py-6 lg:flex lg:flex-col">
        <div className="flex items-center gap-3 px-2">
          <img src="/logo.png" alt="Tasheer Agency Logo" className="h-14 w-14 rounded-2xl object-contain" />
          <div>
            <p className="text-lg font-black tracking-tight text-slate-950">TSMS</p>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Client Portal</p>
          </div>
        </div>

        <nav className="mt-10 space-y-2">
          {navigation.map(item => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.name}
                to={item.path}
                end={item.path === '/client'}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-200'
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                  }`
                }
              >
                <Icon size={20} />
                <span>{item.name}</span>
                {item.name === 'Chat with Staff' && unreadMessagesCount > 0 && (
                  <span className="ml-auto rounded-full bg-green-500 px-2 py-0.5 text-xs font-bold text-white">
                    {unreadMessagesCount}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="mt-auto rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            <span className="text-sm font-bold text-slate-700">Connected Now</span>
          </div>
          <p className="text-xs leading-5 text-slate-500">
            Signed in as {user.full_name || 'Student'}.
          </p>
        </div>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur">
          <div className="flex h-20 items-center justify-between px-5 sm:px-8">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Student Workspace</p>
              <h1 className="mt-1 text-lg font-black text-slate-950">Client Portal</h1>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700 sm:flex">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                Connected Now
              </div>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsNotificationsOpen(prev => !prev)}
                  className="relative rounded-2xl border border-slate-200 bg-white p-3 text-slate-500 shadow-sm hover:text-blue-600"
                  aria-label="Open notifications"
                >
                  <Bell size={19} />
                  {notifications.length > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-black text-white">
                      {notifications.length}
                    </span>
                  )}
                </button>

                {isNotificationsOpen && (
                  <div className="absolute right-0 mt-3 w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                    <div className="border-b border-slate-100 px-4 py-3">
                      <p className="text-sm font-black text-slate-900">Notifications</p>
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <p className="px-4 py-5 text-sm text-slate-500">No unread notifications.</p>
                      ) : (
                        notifications.map(notification => (
                          <button
                            key={notification.id}
                            type="button"
                            onClick={() => handleNotificationClick(notification)}
                            className="block w-full border-b border-slate-50 px-4 py-3 text-left hover:bg-slate-50"
                          >
                            <p className="text-sm font-semibold text-slate-800">{notification.message}</p>
                            <p className="mt-1 text-xs text-slate-400">Open notification</p>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsProfileOpen(prev => !prev)}
                  className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm hover:bg-slate-50"
                >
                  {user.profile_image_url ? (
                    <img src={user.profile_image_url} alt="Profile" className="h-10 w-10 rounded-xl object-cover" />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-sm font-black text-blue-700">
                      {(user.full_name || 'S').charAt(0)}
                    </div>
                  )}
                  <div className="hidden text-left md:block">
                    <p className="text-sm font-black text-slate-900">{user.full_name || 'Student'}</p>
                    <p className="text-xs font-semibold text-slate-400">Student</p>
                  </div>
                  <ChevronDown size={16} className="text-slate-400" />
                </button>

                {isProfileOpen && (
                  <div className="absolute right-0 mt-3 w-56 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                    <button
                      type="button"
                      onClick={() => navigate('/client/settings')}
                      className="flex w-full items-center gap-3 px-4 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50"
                    >
                      <User size={17} />
                      View Profile
                    </button>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex w-full items-center gap-3 px-4 py-3 text-sm font-bold text-rose-600 hover:bg-rose-50"
                    >
                      <LogOut size={17} />
                      Logout
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        <main className="px-5 py-6 sm:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default ClientLayout;
