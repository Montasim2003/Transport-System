'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { loginUser, registerStudent } from '@/lib/auth';
import {
  Mail,
  Lock,
  User,
  IdCard,
  KeyRound,
  X,
  AlertCircle,
  CheckCircle2,
  Menu,
} from 'lucide-react';

export default function AuthLandingPage() {
  const [isPopupOpen, setIsPopupOpen] = useState(true);
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [activeNavInfo, setActiveNavInfo] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // লগইন স্টেট
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // রেজিস্ট্রেশন স্টেট
  const [regName, setRegName] = useState('');
  const [regUniId, setRegUniId] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regCode, setRegCode] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);

  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', text: '' });
  const router = useRouter();

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setFeedback({ type: '', text: '' });
    setLoading(true);

    const res = await loginUser(loginEmail, loginPassword);

    if (!res.success) {
      setFeedback({ type: 'error', text: res.message });
      setLoading(false);
      return;
    }

    localStorage.setItem('transport_user', JSON.stringify(res.user));
    const role = res.user.role;
    if (role === 'student') router.push('/student');
    else if (role === 'driver') router.push('/driver');
    else if (role === 'controller') router.push('/controller');
    else if (role === 'admin') router.push('/admin');
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setFeedback({ type: '', text: '' });

    if (!agreeTerms) {
      setFeedback({ type: 'error', text: 'শর্তাবলীতে (Terms & Conditions) টিক চিহ্ন দাও।' });
      return;
    }

    setLoading(true);
    const res = await registerStudent({
      name: regName,
      uniId: regUniId,
      email: regEmail,
      paymentCode: regCode,
      password: regPassword,
    });

    if (!res.success) {
      setFeedback({ type: 'error', text: res.message });
      setLoading(false);
      return;
    }

    setFeedback({
      type: 'success',
      text: 'রেজিস্ট্রেশন সফল হয়েছে! ড্যাশবোর্ডে নিয়ে যাওয়া হচ্ছে...',
    });
    localStorage.setItem('transport_user', JSON.stringify(res.user));
    setTimeout(() => {
      router.push('/student');
    }, 1000);
  };

  const navDetails = {
    About: {
      title: 'About University Transport',
      body: 'আমাদের স্মার্ট ইউনিভার্সিটি ট্রান্সপোর্ট সিস্টেমের মাধ্যমে শিক্ষার্থীরা নিরাপদে ক্যাম্পাসে যাতায়াত, রিয়েল-টাইম বাস লোকেশন ট্র্যাকিং এবং নির্ধারিত সময়ে সিট বুকিং সুবিধা পায়।',
    },
    Services: {
      title: 'Our Transport Services',
      body: '• বাস ছাড়ার ২৫ মিনিট আগে অনলাইন সিট বুকিং\n• ড্রাইভারের লাইভ GPS ম্যাপ ট্র্যাকিং\n• রুট অনুযায়ী এক্সট্রা বাস অ্যালোকেশন ও ভেরিফাইড স্টুডেন্ট অ্যাক্সেস',
    },
    Contact: {
      title: 'Transport Office Contact',
      body: 'যেকোনো রুট, শিডিউল অথবা ৮-ডিজিট পেমেন্ট ভেরিফিকেশন কোড সংক্রান্ত সহায়তার জন্য বিশ্ববিদ্যালয়ের ট্রান্সপোর্ট কন্ট্রোল রুম (রুম নং-১০২) অথবা transport@uni.edu.bd-এ যোগাযোগ করো।',
    },
  };

  return (
    <div
      className="relative min-h-screen w-full flex flex-col justify-center items-center overflow-x-hidden select-none"
      style={{ fontFamily: "'Poppins', sans-serif" }}
    >
      {/* ভিডিওর মতো নীলচে-ধূসর কুয়াশাচ্ছন্ন বনের ব্যাকগ্রাউন্ড */}
      <div className="fixed inset-0 -z-10 bg-gradient-to-b from-[#9bbad6] via-[#6e96ba] to-[#162938]">
        <svg
          viewBox="0 0 1440 900"
          preserveAspectRatio="xMidYMid slice"
          className="w-full h-full object-cover"
        >
          {/* দূরের কুয়াশাচ্ছন্ন পাহাড় ও গাছপালা */}
          <path
            d="M0,560 Q240,490 480,550 T960,530 T1440,560 L1440,900 L0,900 Z"
            fill="#4d7599"
            opacity="0.45"
          />
          <path
            d="M0,630 Q360,570 720,620 T1440,600 L1440,900 L0,900 Z"
            fill="#345878"
            opacity="0.65"
          />

          {/* দূরের বাঘের সিলুয়েট (ভিডিওর ব্যাকগ্রাউন্ডের মতো) */}
          <g transform="translate(650, 560) scale(0.85)" fill="#5b82a6" opacity="0.55">
            <path d="M20,65 C35,50 65,48 95,52 C115,45 135,46 148,55 C155,60 152,72 142,74 L132,105 L122,105 L126,80 L92,82 L88,108 L78,108 L80,82 L45,82 L38,108 L28,108 L33,80 C20,78 12,72 20,65 Z" />
            <path d="M18,67 Q-5,55 -12,72" stroke="#5b82a6" strokeWidth="5" fill="none" strokeLinecap="round" />
          </g>

          {/* বাম ও ডান পাশের গাঢ় নীল বনের গাছের সিলুয়েট */}
          <g fill="#1d384f">
            <rect x="40" y="0" width="28" height="900" />
            <rect x="115" y="0" width="18" height="900" />
            <rect x="210" y="0" width="38" height="900" />
            <rect x="330" y="0" width="22" height="900" />
            <rect x="1080" y="0" width="24" height="900" />
            <rect x="1190" y="0" width="42" height="900" />
            <rect x="1310" y="0" width="20" height="900" />
            <rect x="1385" y="0" width="32" height="900" />
          </g>

          {/* উপরের ঝুলন্ত লতা ও পাতা */}
          <path
            d="M0,0 L1440,0 L1440,150 Q1200,220 980,120 Q720,250 460,130 Q220,230 0,140 Z"
            fill="#162938"
          />
          <path
            d="M220,110 Q480,260 760,115 Q1020,240 1240,100"
            stroke="#162938"
            strokeWidth="7"
            fill="none"
          />

          {/* সামনের হরিণের সিলুয়েট */}
          <g transform="translate(380, 500) scale(1.1)" fill="#162938">
            <path d="M85,120 C110,110 155,112 180,128 C192,138 190,165 182,185 L176,280 L162,280 L165,195 L115,195 L110,280 L96,280 L100,192 C82,182 72,155 85,120 Z" />
            <path d="M95,130 L72,72 C65,65 55,65 50,70 C54,78 65,80 74,80 L84,135 Z" />
            {/* শিং */}
            <path
              d="M72,68 L62,25 M66,48 L48,36 M64,36 L76,20 M78,68 L92,28 M84,48 L102,38"
              stroke="#162938"
              strokeWidth="4.5"
              strokeLinecap="round"
            />
          </g>

          {/* নিচের ঘাস ও মাটি */}
          <path
            d="M0,760 Q360,720 720,755 T1440,740 L1440,900 L0,900 Z"
            fill="#162938"
          />
        </svg>
      </div>

      {/* উপরের নেভিগেশন বার (ভিডিওর হুবহু স্টাইল) */}
      <header className="fixed top-0 left-0 w-full px-5 sm:px-12 lg:px-24 py-4 sm:py-5 flex justify-between items-center z-40">
        {/* লোগোর জায়গায় Transport */}
        <button
          onClick={() => {
            setActiveNavInfo(null);
            setIsPopupOpen(true);
          }}
          className="text-2xl sm:text-3xl font-bold text-white tracking-wide cursor-pointer"
        >
          Transport
        </button>

        {/* ডেস্কটপ মেনু */}
        <nav className="hidden md:flex items-center">
          <button
            onClick={() => {
              setActiveNavInfo(null);
              setIsPopupOpen(true);
            }}
            className="nav-link relative text-[1.05rem] text-white font-medium ml-9 cursor-pointer"
          >
            Home
          </button>
          {['About', 'Services', 'Contact'].map((item) => (
            <button
              key={item}
              onClick={() => {
                setIsPopupOpen(false);
                setActiveNavInfo(item);
              }}
              className="nav-link relative text-[1.05rem] text-white font-medium ml-9 cursor-pointer"
            >
              {item}
            </button>
          ))}
          <button
            onClick={() => {
              setActiveNavInfo(null);
              setIsPopupOpen(true);
            }}
            className="ml-10 w-[125px] h-[46px] bg-transparent border-2 border-white rounded-[6px] text-[1.05rem] text-white font-medium hover:bg-white hover:text-[#162938] transition duration-500 cursor-pointer"
          >
            Login
          </button>
        </nav>

        {/* মোবাইল মেনু ও লগইন বাটন */}
        <div className="flex md:hidden items-center gap-2.5">
          <button
            onClick={() => {
              setActiveNavInfo(null);
              setIsPopupOpen(true);
              setMobileMenuOpen(false);
            }}
            className="px-4 py-2 bg-transparent border-2 border-white rounded-[6px] text-sm text-white font-semibold hover:bg-white hover:text-[#162938] transition"
          >
            Login
          </button>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-white border border-white/50 rounded-lg"
            aria-label="Menu"
          >
            <Menu size={22} />
          </button>
        </div>
      </header>

      {/* মোবাইল ড্রপডাউন মেনু */}
      {mobileMenuOpen && (
        <div className="fixed top-16 right-5 z-50 md:hidden w-48 rounded-2xl border-2 border-white/50 bg-[#162938]/90 backdrop-blur-xl p-3 flex flex-col gap-2 text-white shadow-xl">
          <button
            onClick={() => {
              setActiveNavInfo(null);
              setIsPopupOpen(true);
              setMobileMenuOpen(false);
            }}
            className="text-left px-3 py-2 rounded-lg hover:bg-white/15 text-sm font-medium"
          >
            Home
          </button>
          {['About', 'Services', 'Contact'].map((item) => (
            <button
              key={item}
              onClick={() => {
                setIsPopupOpen(false);
                setActiveNavInfo(item);
                setMobileMenuOpen(false);
              }}
              className="text-left px-3 py-2 rounded-lg hover:bg-white/15 text-sm font-medium"
            >
              {item}
            </button>
          ))}
        </div>
      )}

      {/* About / Services / Contact ক্লিক করলে গ্লাস ইনফো কার্ড */}
      {activeNavInfo && navDetails[activeNavInfo] && (
        <div className="relative w-[92%] max-w-[440px] rounded-[20px] border-2 border-white/50 bg-white/15 backdrop-blur-[20px] shadow-[0_0_30px_rgba(0,0,0,0.5)] p-8 text-[#162938] mt-16">
          <button
            onClick={() => {
              setActiveNavInfo(null);
              setIsPopupOpen(true);
            }}
            className="absolute top-0 right-0 w-[45px] h-[45px] bg-[#162938] text-white flex items-center justify-center rounded-bl-[20px] rounded-tr-[17px] cursor-pointer"
          >
            <X size={22} />
          </button>
          <h2 className="text-2xl font-bold mb-3">{navDetails[activeNavInfo].title}</h2>
          <p className="text-sm font-medium leading-relaxed whitespace-pre-line">
            {navDetails[activeNavInfo].body}
          </p>
        </div>
      )}

      {/* মূল সোজা Glassmorphism Login & Registration বক্স */}
      <div
        className={`relative w-[92%] max-w-[410px] rounded-[20px] border-2 border-white/50 bg-white/15 backdrop-blur-[20px] shadow-[0_0_30px_rgba(0,0,0,0.5)] overflow-hidden transition-all duration-300 mt-14 sm:mt-16 ${isPopupOpen ? 'scale-100 opacity-100' : 'scale-0 opacity-0 pointer-events-none'
          }`}
      >
        {/* উপরের ডান কোণার Close (×) বাটন */}
        <button
          onClick={() => setIsPopupOpen(false)}
          className="absolute top-0 right-0 w-[45px] h-[45px] bg-[#162938] text-white flex items-center justify-center rounded-bl-[20px] z-20 cursor-pointer hover:bg-[#1e384d] transition"
        >
          <X size={22} />
        </button>

        {/* এরর বা সফলতার মেসেজ */}
        {feedback.text && (
          <div
            className={`mx-7 mt-12 -mb-4 p-2.5 rounded-lg text-xs font-semibold flex items-center gap-2 ${feedback.type === 'error'
              ? 'bg-red-600/90 text-white'
              : 'bg-emerald-700/90 text-white'
              }`}
          >
            {feedback.type === 'error' ? (
              <AlertCircle size={16} className="shrink-0" />
            ) : (
              <CheckCircle2 size={16} className="shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
        )}

        {/* ১. LOGIN ফর্ম (সোজা ও পরিচ্ছন্ন) */}
        {!isRegisterMode ? (
          <div className="w-full p-7 sm:p-10">
            <h2 className="text-[1.85rem] font-bold text-[#162938] text-center mb-6">Login</h2>

            <form onSubmit={handleLoginSubmit} className="space-y-6">
              {/* Student Email ফিল্ড */}
              <div className="relative w-full h-[50px] border-b-2 border-[#162938]">
                <Mail
                  size={19}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[#162938]"
                />
                <input
                  type="text"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder=" "
                  className="peer w-full h-full bg-transparent border-none outline-none text-[0.95rem] text-[#162938] font-semibold pr-8 pl-1 pt-2"
                />
                <label className="absolute left-1 top-1/2 -translate-y-1/2 text-[0.95rem] text-[#162938] font-medium pointer-events-none transition-all duration-300 peer-focus:top-[-4px] peer-focus:text-xs peer-[:not(:placeholder-shown)]:top-[-4px] peer-[:not(:placeholder-shown)]:text-xs">
                  Student Email
                </label>
              </div>

              {/* Password ফিল্ড */}
              <div className="relative w-full h-[50px] border-b-2 border-[#162938]">
                <Lock
                  size={19}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[#162938]"
                />
                <input
                  type="password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder=" "
                  className="peer w-full h-full bg-transparent border-none outline-none text-[0.95rem] text-[#162938] font-semibold pr-8 pl-1 pt-2"
                />
                <label className="absolute left-1 top-1/2 -translate-y-1/2 text-[0.95rem] text-[#162938] font-medium pointer-events-none transition-all duration-300 peer-focus:top-[-4px] peer-focus:text-xs peer-[:not(:placeholder-shown)]:top-[-4px] peer-[:not(:placeholder-shown)]:text-xs">
                  Password
                </label>
              </div>

              {/* Remember me & Forgot Password */}
              <div className="flex items-center justify-between text-[0.82rem] text-[#162938] font-medium pt-1">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" className="accent-[#162938] cursor-pointer" />
                  <span>Remember me</span>
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setFeedback({
                      type: 'error',
                      text: 'পাসওয়ার্ড রিসেট করতে ট্রান্সপোর্ট কন্ট্রোল রুমে যোগাযোগ করো।',
                    })
                  }
                  className="hover:underline cursor-pointer"
                >
                  Forgot Password?
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-[45px] bg-[#162938] hover:bg-[#1f394d] text-white rounded-[6px] text-[1rem] font-medium cursor-pointer transition disabled:opacity-60"
              >
                {loading ? 'Logging in...' : 'Login'}
              </button>

              <div className="text-[0.85rem] text-[#162938] text-center font-medium pt-1">
                <p>
                  Don&apos;t have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setFeedback({ type: '', text: '' });
                      setIsRegisterMode(true);
                    }}
                    className="font-bold hover:underline cursor-pointer"
                  >
                    Register
                  </button>
                </p>
              </div>
            </form>

            {/* demo */}
            <div className="mt-4 p-2.5 rounded-lg bg-white/30 text-[11px] text-[#162938] space-y-0.5">
              <p className="font-bold">Demo Login (Password: 1234):</p>
              <p>• Student: jubair@diu.edu.bd</p>
              <p>• Driver: karim.driver@uni.edu.bd</p>
              <p>• Controller: controller@uni.edu.bd | Admin: admin@uni.edu.bd</p>
            </div>
            {/* demo end */}
          </div>
        ) : (
          /* ২. REGISTRATION ফর্ম (৮-ডিজিট ভার্সিটি পেমেন্ট ভেরিফিকেশন কোডসহ) */
          <div className="w-full p-7 sm:p-9">
            <h2 className="text-[1.75rem] font-bold text-[#162938] text-center mb-4">
              Registration
            </h2>

            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              {/* Full Name */}
              <div className="relative w-full h-[46px] border-b-2 border-[#162938]">
                <User
                  size={18}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[#162938]"
                />
                <input
                  type="text"
                  required
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder=" "
                  className="peer w-full h-full bg-transparent border-none outline-none text-[0.9rem] text-[#162938] font-semibold pr-8 pl-1 pt-2"
                />
                <label className="absolute left-1 top-1/2 -translate-y-1/2 text-[0.9rem] text-[#162938] font-medium pointer-events-none transition-all duration-300 peer-focus:top-[-4px] peer-focus:text-xs peer-[:not(:placeholder-shown)]:top-[-4px] peer-[:not(:placeholder-shown)]:text-xs">
                  Full Name
                </label>
              </div>

              {/* Student ID */}
              <div className="relative w-full h-[46px] border-b-2 border-[#162938]">
                <IdCard
                  size={18}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[#162938]"
                />
                <input
                  type="text"
                  required
                  value={regUniId}
                  onChange={(e) => setRegUniId(e.target.value)}
                  placeholder=" "
                  className="peer w-full h-full bg-transparent border-none outline-none text-[0.9rem] text-[#162938] font-semibold pr-8 pl-1 pt-2 uppercase"
                />
                <label className="absolute left-1 top-1/2 -translate-y-1/2 text-[0.9rem] text-[#162938] font-medium pointer-events-none transition-all duration-300 peer-focus:top-[-4px] peer-focus:text-xs peer-[:not(:placeholder-shown)]:top-[-4px] peer-[:not(:placeholder-shown)]:text-xs">
                  Student ID (e.g. STU-104)
                </label>
              </div>

              {/* Student Email */}
              <div className="relative w-full h-[46px] border-b-2 border-[#162938]">
                <Mail
                  size={18}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[#162938]"
                />
                <input
                  type="email"
                  required
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder=" "
                  className="peer w-full h-full bg-transparent border-none outline-none text-[0.9rem] text-[#162938] font-semibold pr-8 pl-1 pt-2"
                />
                <label className="absolute left-1 top-1/2 -translate-y-1/2 text-[0.9rem] text-[#162938] font-medium pointer-events-none transition-all duration-300 peer-focus:top-[-4px] peer-focus:text-xs peer-[:not(:placeholder-shown)]:top-[-4px] peer-[:not(:placeholder-shown)]:text-xs">
                  Student Email
                </label>
              </div>

              {/* ৮-ডিজিট ভার্সিটি পেমেন্ট ভেরিফিকেশন কোড */}
              <div className="relative w-full h-[46px] border-b-2 border-[#162938]">
                <KeyRound
                  size={18}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[#162938]"
                />
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={8}
                  required
                  value={regCode}
                  onChange={(e) => setRegCode(e.target.value.replace(/\D/g, ''))}
                  placeholder=" "
                  className="peer w-full h-full bg-transparent border-none outline-none text-[0.9rem] text-[#162938] font-bold tracking-widest pr-8 pl-1 pt-2"
                />
                <label className="absolute left-1 top-1/2 -translate-y-1/2 text-[0.88rem] text-[#162938] font-medium pointer-events-none transition-all duration-300 peer-focus:top-[-4px] peer-focus:text-xs peer-[:not(:placeholder-shown)]:top-[-4px] peer-[:not(:placeholder-shown)]:text-xs">
                  8-Digit Payment Code
                </label>
              </div>

              {/* Password */}
              <div className="relative w-full h-[46px] border-b-2 border-[#162938]">
                <Lock
                  size={18}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[#162938]"
                />
                <input
                  type="password"
                  required
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder=" "
                  className="peer w-full h-full bg-transparent border-none outline-none text-[0.9rem] text-[#162938] font-semibold pr-8 pl-1 pt-2"
                />
                <label className="absolute left-1 top-1/2 -translate-y-1/2 text-[0.9rem] text-[#162938] font-medium pointer-events-none transition-all duration-300 peer-focus:top-[-4px] peer-focus:text-xs peer-[:not(:placeholder-shown)]:top-[-4px] peer-[:not(:placeholder-shown)]:text-xs">
                  Password
                </label>
              </div>

              <label className="flex items-center gap-2 text-[0.8rem] text-[#162938] font-medium pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  className="accent-[#162938] cursor-pointer"
                />
                <span>I agree to the terms &amp; conditions</span>
              </label>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-[44px] bg-[#162938] hover:bg-[#1f394d] text-white rounded-[6px] text-[0.95rem] font-medium cursor-pointer transition disabled:opacity-60"
              >
                {loading ? 'Verifying Code...' : 'Register'}
              </button>

              <div className="text-[0.82rem] text-[#162938] text-center font-medium">
                <p>
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setFeedback({ type: '', text: '' });
                      setIsRegisterMode(false);
                    }}
                    className="font-bold hover:underline cursor-pointer"
                  >
                    Login
                  </button>
                </p>
              </div>
            </form>

            {/* demo */}
            <div className="mt-3 p-2 rounded-lg bg-white/30 text-[11px] text-[#162938]">
              <p className="font-bold">Demo 8-Digit Code Test:</p>
              <p>ID: <b>STU-104</b> | 8-Digit Code: <b>20261001</b></p>
            </div>
            {/* demo end */}
          </div>
        )}
      </div>

      {/* নেভিগেশন লিংকের সাদা আন্ডারলাইন অ্যানিমেশনের জন্য CSS */}
      <style jsx>{`
        .nav-link::after {
          content: '';
          position: absolute;
          left: 0;
          bottom: -6px;
          width: 100%;
          height: 3px;
          background: #fff;
          border-radius: 5px;
          transform-origin: right;
          transform: scaleX(0);
          transition: transform 0.5s;
        }
        .nav-link:hover::after {
          transform-origin: left;
          transform: scaleX(1);
        }
      `}</style>
    </div>
  );
}