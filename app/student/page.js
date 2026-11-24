'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import LiveBusMap from '@/components/LiveBusMap';
import {
    Bus,
    MapPin,
    Clock,
    CheckCircle2,
    Lock,
    LogOut,
    AlertCircle,
    Sparkles,
    Trash2,
    Navigation,
    Armchair,
} from 'lucide-react';

export default function StudentDashboard() {
    const [user, setUser] = useState(null);
    const [routes, setRoutes] = useState([]);
    const [selectedRouteId, setSelectedRouteId] = useState('');
    const [schedules, setSchedules] = useState([]);
    const [selectedSchedule, setSelectedSchedule] = useState(null);
    const [liveBus, setLiveBus] = useState(null);
    const [bookedSeats, setBookedSeats] = useState([]);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    // demo
    // স্যারদের প্রেজেন্টেশনের সময় যেকোনো টাইমে সিট বুকিং দেখানোর জন্য ডেমো আনলক
    const [demoUnlock, setDemoUnlock] = useState(false);
    // demo end

    const router = useRouter();
    const today = new Date().toISOString().split('T')[0];

    useEffect(() => {
        const saved = JSON.parse(localStorage.getItem('transport_user'));
        if (!saved || saved.role !== 'student') {
            router.push('/');
            return;
        }
        setUser(saved);
        if (saved.selected_route_id) {
            setSelectedRouteId(String(saved.selected_route_id));
        }

        async function fetchRoutes() {
            const { data } = await supabase.from('routes').select('*').order('id');
            if (data) setRoutes(data);
        }
        fetchRoutes();
    }, [router]);

    const handleRouteChange = async (routeId) => {
        setSelectedRouteId(routeId);
        setSelectedSchedule(null);
        setLiveBus(null);
        setBookedSeats([]);
        setMessage({ type: '', text: '' });

        if (!routeId) return;

        await supabase
            .from('users')
            .update({ selected_route_id: Number(routeId) })
            .eq('id', user.id);

        const updatedUser = { ...user, selected_route_id: Number(routeId) };
        setUser(updatedUser);
        localStorage.setItem('transport_user', JSON.stringify(updatedUser));
    };

    useEffect(() => {
        if (!selectedRouteId) {
            setSchedules([]);
            return;
        }

        async function fetchSchedules() {
            const { data } = await supabase
                .from('schedules')
                .select('*, buses(*)')
                .eq('route_id', Number(selectedRouteId))
                .order('departure_time', { ascending: true });

            if (data) {
                setSchedules(data);
                if (data.length > 0 && data[0].buses) {
                    setLiveBus(data[0].buses);
                }
            }
        }
        fetchSchedules();
    }, [selectedRouteId]);

    // নির্বাচিত বাসের লাইভ GPS লোকেশন প্রতি ৩ সেকেন্ড পরপর আপডেট
    useEffect(() => {
        const targetBusId = selectedSchedule?.bus_id || schedules[0]?.bus_id;
        if (!targetBusId) return;

        const interval = setInterval(async () => {
            const { data } = await supabase
                .from('buses')
                .select('*')
                .eq('id', targetBusId)
                .single();

            if (data) setLiveBus(data);
        }, 3000);

        return () => clearInterval(interval);
    }, [selectedSchedule, schedules]);

    const fetchBookings = useCallback(
        async (scheduleId) => {
            const { data } = await supabase
                .from('bookings')
                .select('*')
                .eq('schedule_id', scheduleId)
                .eq('booking_date', today);

            if (data) setBookedSeats(data);
        },
        [today]
    );

    // অন্য কোনো স্টুডেন্ট সিট বুক করলে রিয়েলটাইম আপডেট দেখার জন্য প্রতি ৪ সেকেন্ডে সিট রিফ্রেশ
    useEffect(() => {
        if (!selectedSchedule?.id) return;
        const seatInterval = setInterval(() => {
            fetchBookings(selectedSchedule.id);
        }, 4000);
        return () => clearInterval(seatInterval);
    }, [selectedSchedule, fetchBookings]);

    const handleSelectSchedule = async (schedule) => {
        setSelectedSchedule(schedule);
        setLiveBus(schedule.buses);
        setMessage({ type: '', text: '' });
        await fetchBookings(schedule.id);

        await supabase
            .from('users')
            .update({ selected_time: schedule.departure_time })
            .eq('id', user.id);
    };

    const formatTime = (timeStr) => {
        if (!timeStr) return '';
        const [h, m] = timeStr.split(':').map(Number);
        const ampm = h >= 12 ? 'PM' : 'AM';
        const hour12 = h % 12 || 12;
        return `${hour12}:${String(m).padStart(2, '0')} ${ampm}`;
    };

    const checkBookingWindow = (departureTime) => {
        // demo
        if (demoUnlock) {
            return { isOpen: true, statusText: 'Demo Mode: বুকিং আনলক' };
        }
        // demo end

        const [hours, minutes] = departureTime.split(':').map(Number);
        const now = new Date();
        const depDate = new Date();
        depDate.setHours(hours, minutes, 0, 0);

        const diffMins = Math.round((depDate - now) / (1000 * 60));

        if (diffMins > 25) {
            return {
                isOpen: false,
                statusText: `আরও ${diffMins - 25} মিনিট পর খুলবে`,
            };
        } else if (diffMins <= 0) {
            return {
                isOpen: false,
                statusText: 'সময় শেষ হয়ে গেছে',
            };
        } else {
            return {
                isOpen: true,
                statusText: `বুকিং চলছে (${diffMins} মিনিট বাকি)`,
            };
        }
    };

    const handleBookSeat = async (seatNumber) => {
        if (!selectedSchedule || loading) return;

        const windowStatus = checkBookingWindow(selectedSchedule.departure_time);
        if (!windowStatus.isOpen) {
            setMessage({ type: 'error', text: windowStatus.statusText });
            return;
        }

        const myExistingBooking = bookedSeats.find((b) => b.student_id === user.id);
        if (myExistingBooking) {
            setMessage({
                type: 'error',
                text: `তুমি ইতিমধ্যে সিট #${myExistingBooking.seat_number} বুক করেছ।`,
            });
            return;
        }

        setLoading(true);
        setMessage({ type: '', text: '' });

        const { error } = await supabase.from('bookings').insert({
            student_id: user.id,
            schedule_id: selectedSchedule.id,
            seat_number: seatNumber,
            booking_date: today,
            status: 'confirmed',
        });

        if (error) {
            setMessage({
                type: 'error',
                text: 'দুঃখিত! এই সিটটি এই মুহূর্তে অন্য কেউ বুক করে ফেলেছে।',
            });
        } else {
            setMessage({
                type: 'success',
                text: `অভিনন্দন! তোমার সিট #${seatNumber} বুক হয়েছে।`,
            });
        }

        await fetchBookings(selectedSchedule.id);
        setLoading(false);
    };

    const handleCancelBooking = async () => {
        if (!selectedSchedule || loading) return;
        setLoading(true);

        await supabase
            .from('bookings')
            .delete()
            .eq('student_id', user.id)
            .eq('schedule_id', selectedSchedule.id)
            .eq('booking_date', today);

        setMessage({ type: 'success', text: 'তোমার সিট বুকিং বাতিল করা হয়েছে।' });
        await fetchBookings(selectedSchedule.id);
        setLoading(false);
    };

    if (!user) return null;

    const activeRoute = routes.find((r) => String(r.id) === String(selectedRouteId));
    const myBooking = bookedSeats.find((b) => b.student_id === user.id);
    const totalSeats = selectedSchedule?.buses?.total_seats || 40;

    return (
        <div className="min-h-screen bg-slate-100 text-slate-800 pb-12 overflow-x-hidden">
            {/* স্টিকি মোবাইল ও ল্যাপটপ ফ্রেন্ডলি নেভিগেশন বার */}
            <header className="sticky top-0 z-30 bg-slate-900 text-white px-4 sm:px-6 py-3.5 shadow-md flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className="bg-blue-600 p-2 rounded-xl shrink-0">
                        <Bus size={20} />
                    </div>
                    <div className="truncate">
                        <h1 className="font-bold text-sm sm:text-lg leading-tight truncate">
                            Student Transport
                        </h1>
                        <p className="text-[11px] sm:text-xs text-slate-300 truncate">
                            {user.name} • {user.uni_id}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    {/* demo */}
                    <button
                        onClick={() => setDemoUnlock(!demoUnlock)}
                        className={`flex items-center gap-1 px-2.5 py-2 rounded-xl text-xs font-bold transition ${demoUnlock
                                ? 'bg-amber-500 text-slate-900'
                                : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                            }`}
                    >
                        <Sparkles size={14} />
                        <span>{demoUnlock ? 'Demo: ON' : 'Demo: OFF'}</span>
                    </button>
                    {/* demo end */}

                    <button
                        onClick={() => {
                            localStorage.removeItem('transport_user');
                            router.push('/');
                        }}
                        className="flex items-center gap-1 bg-red-600 hover:bg-red-700 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition"
                    >
                        <LogOut size={15} />
                        <span className="hidden sm:inline">Logout</span>
                    </button>
                </div>
            </header>

            {/* মেইন কন্টেইনার: মোবাইলে সিঙ্গেল কলাম, ল্যাপটপে পাশাপাশি ২ কলাম */}
            <main className="max-w-7xl mx-auto p-3.5 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                {/* বাম কলাম (ল্যাপটপে ৭ ভাগ জায়গা নেবে): রুট + শিডিউল + লাইভ ম্যাপ */}
                <div className="lg:col-span-7 space-y-5">
                    {/* ধাপ ১: এরিয়া / রুট নির্বাচন */}
                    <section className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-200">
                        <h2 className="text-base sm:text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
                            <MapPin className="text-blue-600 shrink-0" size={20} />
                            ১. তোমার রুট (এরিয়া) বেছে নাও
                        </h2>

                        <select
                            value={selectedRouteId}
                            onChange={(e) => handleRouteChange(e.target.value)}
                            className="w-full p-3.5 border border-slate-300 rounded-xl bg-slate-50 font-semibold text-sm sm:text-base focus:outline-none focus:border-blue-600"
                        >
                            <option value="">-- রুট সিলেক্ট করো --</option>
                            {routes.map((route) => (
                                <option key={route.id} value={route.id}>
                                    {route.route_name}
                                </option>
                            ))}
                        </select>

                        {activeRoute && (
                            <div className="mt-4 p-3.5 bg-blue-50 rounded-xl border border-blue-100">
                                <p className="text-xs font-bold text-blue-800 mb-2">এই রুটের স্টপেজসমূহ:</p>
                                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                                    {activeRoute.stoppages.map((stop, index) => (
                                        <span key={index} className="flex items-center gap-1">
                                            <span className="bg-white px-2.5 py-1 rounded-lg border border-blue-200 font-medium text-slate-700">
                                                {stop}
                                            </span>
                                            {index < activeRoute.stoppages.length - 1 && (
                                                <span className="text-blue-400">→</span>
                                            )}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </section>

                    {/* ধাপ ২: বাসের সময়সূচি নির্বাচন */}
                    {selectedRouteId && (
                        <section className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-200">
                            <h2 className="text-base sm:text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
                                <Clock className="text-blue-600 shrink-0" size={20} />
                                ২. বাসের সময়সূচি (Schedule) বেছে নাও
                            </h2>

                            {schedules.length === 0 ? (
                                <p className="text-slate-500 text-sm">এই রুটে এখনো কোনো শিডিউল নেই।</p>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {schedules.map((sch) => {
                                        const win = checkBookingWindow(sch.departure_time);
                                        const isSelected = selectedSchedule?.id === sch.id;

                                        return (
                                            <button
                                                key={sch.id}
                                                onClick={() => handleSelectSchedule(sch)}
                                                className={`text-left p-4 rounded-xl border-2 transition active:scale-[0.98] ${isSelected
                                                        ? 'border-blue-600 bg-blue-50 shadow-sm'
                                                        : 'border-slate-200 hover:border-blue-300 bg-white'
                                                    }`}
                                            >
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className="font-bold text-lg text-slate-800">
                                                        {formatTime(sch.departure_time)}
                                                    </span>
                                                    <span className="text-xs font-bold bg-slate-800 text-white px-2.5 py-1 rounded-lg">
                                                        {sch.buses?.bus_number}
                                                    </span>
                                                </div>
                                                <p
                                                    className={`text-xs mt-2 flex items-center gap-1.5 font-semibold ${win.isOpen ? 'text-emerald-600' : 'text-amber-600'
                                                        }`}
                                                >
                                                    {win.isOpen ? <CheckCircle2 size={14} /> : <Lock size={14} />}
                                                    {win.statusText}
                                                </p>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </section>
                    )}

                    {/* লাইভ বাস ট্র্যাকিং ম্যাপ */}
                    {selectedRouteId && liveBus && (
                        <section className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-200 space-y-3">
                            <div className="flex items-center justify-between gap-2">
                                <h2 className="text-base sm:text-lg font-bold text-slate-800 flex items-center gap-2">
                                    <Navigation className="text-emerald-600 shrink-0" size={20} />
                                    লাইভ বাস ট্র্যাকিং ({liveBus.bus_number})
                                </h2>
                                <span className="text-[11px] text-slate-400 shrink-0">অটো-আপডেট (৩সে.)</span>
                            </div>
                            <LiveBusMap bus={liveBus} routeName={activeRoute?.route_name} />
                        </section>
                    )}
                </div>

                {/* ডান কলাম (ল্যাপটপে ৫ ভাগ জায়গা নিয়ে স্টিকি থাকবে): ৪০ সিটের বাস লেআউট */}
                <div className="lg:col-span-5 lg:sticky lg:top-20">
                    {!selectedSchedule ? (
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 text-center space-y-2">
                            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                                <Armchair size={24} />
                            </div>
                            <h3 className="font-bold text-slate-700 text-base">সিট বুকিং প্যানেল</h3>
                            <p className="text-xs sm:text-sm text-slate-500">
                                বাম পাশ থেকে রুট এবং বাসের সময়সূচি সিলেক্ট করলে এখানে ৪০ সিটের বাস লেআউট চলে আসবে।
                            </p>
                        </div>
                    ) : (
                        <section className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-200">
                            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                                <div>
                                    <h2 className="text-base sm:text-lg font-bold text-slate-800">
                                        ৩. সিট বুকিং — {selectedSchedule.buses?.bus_number}
                                    </h2>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        সময়: <b>{formatTime(selectedSchedule.departure_time)}</b> • খালি:{' '}
                                        <b className="text-emerald-600">{totalSeats - bookedSeats.length}</b>/{totalSeats}
                                    </p>
                                </div>

                                {myBooking && (
                                    <div className="flex items-center gap-2.5 bg-blue-50 border border-blue-200 px-3 py-2 rounded-xl w-full sm:w-auto justify-between">
                                        <span className="text-sm font-bold text-blue-800">
                                            তোমার সিট: #{myBooking.seat_number}
                                        </span>
                                        <button
                                            onClick={handleCancelBooking}
                                            disabled={loading}
                                            className="flex items-center gap-1 text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg font-semibold"
                                        >
                                            <Trash2 size={14} />
                                            বাতিল
                                        </button>
                                    </div>
                                )}
                            </div>

                            {message.text && (
                                <div
                                    className={`p-3 rounded-xl mb-4 flex items-center gap-2 text-xs sm:text-sm font-semibold ${message.type === 'error'
                                            ? 'bg-red-50 text-red-700 border border-red-200'
                                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                        }`}
                                >
                                    <AlertCircle size={18} className="shrink-0" />
                                    <span>{message.text}</span>
                                </div>
                            )}

                            <div className="flex flex-wrap gap-3 text-xs mb-4 bg-slate-50 p-3 rounded-xl justify-center">
                                <div className="flex items-center gap-1.5">
                                    <span className="w-3.5 h-3.5 rounded bg-emerald-100 border border-emerald-500 inline-block"></span>
                                    <span>খালি</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="w-3.5 h-3.5 rounded bg-blue-600 inline-block"></span>
                                    <span>তোমার সিট</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="w-3.5 h-3.5 rounded bg-red-500 inline-block"></span>
                                    <span>বুকড</span>
                                </div>
                            </div>

                            <div className="max-w-xs mx-auto bg-slate-50 p-4 rounded-2xl border-2 border-slate-300">
                                <div className="text-right mb-3.5 pb-2 border-b border-dashed border-slate-300">
                                    <span className="text-xs font-bold bg-slate-700 text-white px-3 py-1 rounded-full">
                                        Driver Seat
                                    </span>
                                </div>

                                <div className="grid grid-cols-5 gap-2">
                                    {Array.from({ length: totalSeats }, (_, i) => i + 1).map((seatNum) => {
                                        const booking = bookedSeats.find((b) => b.seat_number === seatNum);
                                        const isMine = booking?.student_id === user.id;
                                        const isTaken = Boolean(booking) && !isMine;
                                        const isWindowOpen = checkBookingWindow(selectedSchedule.departure_time).isOpen;
                                        const showAisle = seatNum % 4 === 2;

                                        return (
                                            <div key={seatNum} className="contents">
                                                <button
                                                    disabled={isTaken || isMine || !isWindowOpen || loading}
                                                    onClick={() => handleBookSeat(seatNum)}
                                                    className={`h-11 sm:h-12 rounded-xl font-bold text-sm transition flex items-center justify-center active:scale-95 ${isMine
                                                            ? 'bg-blue-600 text-white shadow'
                                                            : isTaken
                                                                ? 'bg-red-500 text-white cursor-not-allowed opacity-85'
                                                                : !isWindowOpen
                                                                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                                                    : 'bg-emerald-50 border-2 border-emerald-500 text-emerald-800 hover:bg-emerald-500 hover:text-white'
                                                        }`}
                                                >
                                                    {seatNum}
                                                </button>
                                                {showAisle && <div className="w-3"></div>}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </section>
                    )}
                </div>
            </main>
        </div>
    );
}