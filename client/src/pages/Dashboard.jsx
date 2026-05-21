import { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { LogOut, GraduationCap, CheckCircle2, Circle } from 'lucide-react';

const STAGES = [
  "Initial Inquiry", 
  "Document Submission", 
  "Document Verification", 
  "University Application", 
  "Offer Letter Issued", 
  "EMGS/VAL Processing", 
  "VAL Issued", 
  "Pre-Departure", 
  "Arrival & Endorsement"
];

const Dashboard = () => {
  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(true);
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchApplication = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get('/api/applications/my-application', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.data.length > 0) {
          setApplication(res.data[0]);
        }
      } catch (err) {
        console.error('Error fetching application data', err);
      } finally {
        setLoading(false);
      }
    };
    fetchApplication();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-agency-grey">Loading...</div>;
  }

  const currentStageIndex = application ? application.current_stage - 1 : -1;

  return (
    <div className="min-h-screen bg-agency-grey pb-10">
      {/* Navbar */}
      <nav className="bg-agency-blue text-agency-white p-4 shadow-md">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <GraduationCap className="h-6 w-6" />
            <span className="font-bold text-xl">Tasheer Agency</span>
          </div>
          <button onClick={handleLogout} className="flex items-center space-x-1 hover:text-blue-200 transition-colors">
            <LogOut className="h-4 w-4" />
            <span>Logout</span>
          </button>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto p-6 md:p-8">
        <div className="bg-agency-white rounded-xl shadow-sm p-6 mb-8">
          <h2 className="text-2xl font-bold text-agency-blue mb-2">Welcome, {user.full_name || 'Student'}</h2>
          <p className="text-agency-darkGrey">Track your study abroad application progress below.</p>
        </div>

        {application ? (
          <div className="bg-agency-white rounded-xl shadow-sm p-8">
            <div className="mb-8 border-b pb-6">
              <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold mb-2 uppercase ${
                application.status === 'approved' ? 'bg-green-100 text-green-700' :
                application.status === 'rejected' ? 'bg-red-100 text-red-700' :
                'bg-yellow-100 text-yellow-700'
              }`}>
                {application.status}
              </span>
              <h3 className="text-xl font-bold text-gray-800">{application.university_name}</h3>
              <p className="text-agency-darkGrey text-sm">{application.program_name}</p>
            </div>

            <div className="relative">
              {/* Stepper Logic Component designed responsively */}
              <div className="md:flex md:flex-row flex-col items-start justify-between relative">
                {/* Horizontal line for Desktop */}
                <div className="hidden md:block absolute top-[15px] left-0 right-0 h-1 bg-gray-200 -z-10"></div>
                {/* Vertical Line for Mobile */}
                <div className="block md:hidden absolute left-[15px] top-0 bottom-0 w-1 bg-gray-200 -z-10"></div>

                {STAGES.map((stage, idx) => {
                  const isCompleted = idx < currentStageIndex;
                  const isCurrent = idx === currentStageIndex;
                  let iconColor = "text-gray-300";
                  let textColor = "text-gray-400";
                  let fontWeight = "font-normal";

                  if (isCompleted) {
                    iconColor = "text-agency-lightBlue";
                    textColor = "text-agency-darkGrey";
                  } else if (isCurrent) {
                     // Blue solid circle
                    iconColor = "text-agency-blue";
                    textColor = "text-agency-blue";
                    fontWeight = "font-bold";
                  }

                  return (
                     <div key={idx} className="flex md:flex-col items-center mb-8 md:mb-0 relative text-center w-full md:w-auto">
                        <div className={`flex-shrink-0 bg-white rounded-full p-1 ${isCurrent ? 'ring-4 ring-blue-100' : ''}`}>
                           {isCompleted ? (
                             <CheckCircle2 fill="white" className={`w-6 h-6 ${iconColor}`} />
                           ) : isCurrent ? (
                             <Circle fill="#1E3A8A" className={`w-6 h-6 ${iconColor}`} />
                           ) : (
                             <Circle fill="#E5E7EB" className={`w-6 h-6 text-transparent`} />
                           )}
                        </div>
                        <div className="ml-4 md:ml-0 md:mt-4 md:max-w-[70px] lg:max-w-[90px]">
                           <span className={`text-xs md:text-sm block leading-tight ${textColor} ${fontWeight}`}>
                              {stage}
                           </span>
                        </div>
                     </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center text-yellow-800">
            <h3 className="font-bold mb-2">No Application Found</h3>
            <p className="text-sm">Please contact support to start your application process.</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
