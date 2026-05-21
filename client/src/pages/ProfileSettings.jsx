import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { User, Lock, ArrowLeft, Camera, Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ProfileSettings = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    newPassword: ''
  });
  const [role, setRole] = useState('');
  const [roleLabel, setRoleLabel] = useState('');
  const [department, setDepartment] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [profileImageUrl, setProfileImageUrl] = useState('');
  const [userId, setUserId] = useState(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get('/api/users/profile', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setFormData({
          name: res.data.full_name || '',
          email: res.data.email || '',
          phone: res.data.phone || '',
          newPassword: ''
        });
        setUserId(res.data.id);
        setProfileImageUrl(res.data.profile_image_url || '');
        setRole(res.data.role || '');
        setDepartment(res.data.department || '');
        setJobTitle(res.data.job_title || '');
        setRoleLabel(res.data.job_title || res.data.department || res.data.role || 'User');
      } catch (err) {
        console.error('Error fetching profile:', err);
      }
    };
    fetchProfile();
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setSuccessMessage('');
    setError('');

    try {
      const token = localStorage.getItem('token');
      await axios.put('/api/users/profile', {
        full_name: formData.name,
        email: formData.email,
        phone: formData.phone,
        password: formData.newPassword ? formData.newPassword : undefined
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setSuccessMessage('Profile updated successfully!');
      setFormData(prev => ({ ...prev, newPassword: '' })); // Clear password
      
      // Update local storage user name
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      user.full_name = formData.name;
      user.profile_image_url = profileImageUrl;
      user.department = department;
      user.job_title = jobTitle;
      localStorage.setItem('user', JSON.stringify(user));
      window.dispatchEvent(new Event('userUpdated'));

      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      console.error('Error updating profile:', err);
      setError('Failed to update profile. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleProfileImageUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !userId) return;

    try {
      setIsUploadingImage(true);
      setError('');
      const token = localStorage.getItem('token');
      const data = new FormData();
      data.append('profile_image', file);

      const res = await axios.put(`/api/users/${userId}/profile-image`, data, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      const nextImageUrl = res.data.profile_image_url;
      setProfileImageUrl(nextImageUrl);
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      user.profile_image_url = nextImageUrl;
      localStorage.setItem('user', JSON.stringify(user));
      window.dispatchEvent(new Event('userUpdated'));
      setSuccessMessage('Profile image updated successfully!');
    } catch (err) {
      console.error('Error uploading profile image:', err);
      setError('Failed to upload profile image. Please try again.');
    } finally {
      setIsUploadingImage(false);
      event.target.value = '';
    }
  };

  const getRoleDisplay = () => roleLabel || role || 'User';

  const goBack = () => {
    if (role === 'admin') navigate('/admin');
    else if (role === 'staff') navigate('/staff');
    else navigate('/client');
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        
        <div className="flex items-center space-x-4 mb-8">
           <button onClick={goBack} className="p-2 bg-white rounded-full shadow-sm hover:bg-gray-100 transition-colors">
              <ArrowLeft className="w-5 h-5 text-gray-600" />
           </button>
           <h1 className="text-3xl font-bold text-gray-800 tracking-tight">Profile Settings</h1>
        </div>

        {successMessage && (
          <div className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-lg mb-6 shadow-sm">
            {successMessage}
          </div>
        )}
        
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg mb-6 shadow-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Left Column (Form) */}
          <div className="md:col-span-2">
            <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                  <User className="w-5 h-5 text-agency-blue" />
                  Basic Information
                </h3>
              </div>
              <div className="p-6 space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Full Name</label>
                  <input 
                    type="text" 
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-lg focus:ring-agency-blue focus:border-agency-blue block p-2.5 outline-none transition-colors"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Email Address</label>
                  <input 
                    type="email" 
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-lg focus:ring-agency-blue focus:border-agency-blue block p-2.5 outline-none transition-colors"
                    required
                  />
                </div>
                {role === 'client' && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Phone Number</label>
                    <input 
                      type="tel" 
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-lg focus:ring-agency-blue focus:border-agency-blue block p-2.5 outline-none transition-colors"
                    />
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-b border-gray-100 bg-gray-50/50 mt-4">
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                  <Lock className="w-5 h-5 text-gray-500" />
                  Change Password (Optional)
                </h3>
              </div>
              <div className="p-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">New Password</label>
                  <input 
                    type="password" 
                    name="newPassword"
                    value={formData.newPassword}
                    onChange={handleChange}
                    placeholder="Leave blank to keep current password"
                    className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-lg focus:ring-agency-blue focus:border-agency-blue block p-2.5 outline-none transition-colors"
                  />
                </div>
              </div>

              <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end">
                <button 
                  type="submit" 
                  disabled={isLoading}
                  className="bg-agency-blue hover:bg-agency-lightBlue text-white px-6 py-2.5 rounded-lg font-semibold shadow-sm transition-colors flex items-center gap-2 disabled:opacity-70"
                >
                  {isLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>

          {/* Right Column (Profile Card) */}
          <div className="md:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden relative text-center">
              <div className="h-24 bg-agency-blue w-full"></div>
              <div className="relative -mt-12 mb-4 flex justify-center">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="relative h-24 w-24 bg-white rounded-full p-1 shadow-md group"
                  aria-label="Upload profile image"
                >
                  {profileImageUrl ? (
                    <img src={profileImageUrl} alt="Profile" className="h-full w-full rounded-full object-cover" />
                  ) : (
                    <div className="h-full w-full bg-blue-100 rounded-full flex items-center justify-center text-agency-blue text-3xl font-bold">
                      {formData.name ? formData.name.charAt(0).toUpperCase() : 'U'}
                    </div>
                  )}
                  <span className="absolute bottom-1 right-1 flex h-8 w-8 items-center justify-center rounded-full bg-agency-blue text-white shadow-sm">
                    <Camera size={15} />
                  </span>
                </button>
              </div>
              <div className="px-6 pb-8">
                <h2 className="text-xl font-bold text-gray-800">{formData.name || 'User'}</h2>
                <div className="mt-3 inline-flex px-4 py-1.5 bg-blue-50 text-agency-blue font-bold text-xs uppercase tracking-wider rounded-full border border-blue-100">
                  {getRoleDisplay()}
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleProfileImageUpload} />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingImage}
                  className="mx-auto mt-5 flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-100 disabled:opacity-60"
                >
                  <Upload size={15} />
                  {isUploadingImage ? 'Uploading...' : 'Upload Image'}
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default ProfileSettings;
