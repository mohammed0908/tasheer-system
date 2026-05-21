import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/auth/LoginPage';
import SignupPage from './pages/auth/SignupPage';
import VerifyEmailPage from './pages/auth/VerifyEmailPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';
import ClientDashboard from './pages/ClientDashboard';
import StaffDashboard from './pages/StaffDashboard';
import StaffClients from './pages/StaffClients';
import StaffInvoices from './pages/StaffInvoices';
import StaffSettings from './pages/StaffSettings';
import StaffChat from './pages/StaffChat';
import AdminDashboard from './pages/AdminDashboard';
import AdminLayout from './components/AdminLayout';
import StaffLayout from './layouts/StaffLayout';
import ClientLayout from './layouts/ClientLayout';
import ProtectedRoute from './components/ProtectedRoute';
import ProfileSettings from './pages/ProfileSettings';

import StaffManagement from './pages/StaffManagement';
import ClientManagement from './pages/ClientManagement';
import TaskManagement from './pages/TaskManagement';
import PaymentManagement from './pages/PaymentManagement';
import AdminGoals from './pages/AdminGoals';
import AdminFinance from './pages/AdminFinance';
import ClientPayments from './pages/ClientPayments';
import ClientChat from './pages/ClientChat';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route 
          path="/settings/profile" 
          element={
            <ProtectedRoute>
              <ProfileSettings />
            </ProtectedRoute>
          } 
        />
        <Route
          path="/client"
          element={
            <ProtectedRoute allowedRoles={['client']}>
              <ClientLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<ClientDashboard />} />
          <Route path="payments" element={<ClientPayments />} />
          <Route path="settings" element={<ProfileSettings />} />
          <Route path="chat" element={<ClientChat />} />
        </Route>
        <Route
          path="/staff"
          element={
            <ProtectedRoute allowedRoles={['staff']}>
              <StaffLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<StaffDashboard />} />
          <Route path="clients" element={<StaffClients />} />
          <Route path="invoices" element={<StaffInvoices />} />
          <Route path="messages" element={<StaffChat />} />
          <Route path="settings" element={<StaffSettings />} />
        </Route>
        <Route 
          path="/admin" 
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminLayout />
            </ProtectedRoute>
          } 
        >
          <Route index element={<AdminDashboard />} />
          <Route path="clients" element={<ClientManagement />} />
          <Route path="staff" element={<StaffManagement />} />
          <Route path="tasks" element={<TaskManagement />} />
          <Route path="payments" element={<PaymentManagement />} />
          <Route path="finance" element={<AdminFinance />} />
          <Route path="goals" element={<AdminGoals />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
