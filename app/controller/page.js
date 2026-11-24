'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import LiveBusMap from '@/components/LiveBusMap';
import {
    Bus,
    Users,
    PlusCircle,
    LogOut,
    Clock,
    MapPin,
    RefreshCw,
    CheckCircle2,
    Phone,
    CreditCard,
    Home,
    UserCheck,
    Navigation,
    User,
} from 'lucide-react';

export default function ControllerDashboard() {
    const [user, setUser] = useState(null);
    const [routes, setRoutes] = useState([]);
    const [buses, setBuses] = useState([]);
    const [drivers, setDrivers] = useState([]);
    const [schedules, setSchedules] = useState([]);
    const [bookings, setBookings] = useState([]);
    const [routeInterest, setRouteInterest] = useState([]);

    // যে বাস নম্বরে ক্লিক করা হবে তার ID
    const [selectedBusId, setSelectedBusId] = useState(null);

    // নতুন শিডিউল / এক্সট্রা বাস দেওয়ার ফর্ম স্টেট
    const [newBusId, setNewBusId] = useState('');
    const [newRouteId, setNewRouteId] = useState('');
    const [newTime, setNewTime] = useState('17:30');
    const [toast, setToast] = useState('');

    const router = useRouter();
    const today = new Date().toISOString().split('T')[0];

    const loadAllData = useCallback(async () => {
        const [rRes, bRes, dRes, sRes, bkRes, uRes] = await Promise.all([
            supabase.from('routes').select('*').order('id'),
            supabase.from('buses').select('*, routes(*), users(*)').order('id'),
            supabase.from('users').select('*').eq('role', 'driver'),
            supabase.from('schedules').select('*, buses(*), routes(*)').order('departure_time'),
            supabase.from('bookings').select('*').eq('booking_date', today),
            supabase.from('users').select('selected_route_id').eq('role', 'student'),
        ]);

        if (rRes.data) setRoutes(rRes.data);
        if (bRes.data) {
            setBuses(bRes.data);
            setSelectedBusId((prev) => prev || bRes.data[0]?.id || null);
        }
        if (dRes.data) setDrivers(dRes.data);
        if (sRes.data) setSchedules(sRes.data);
        if (bkRes.data) setBookings(bkRes.data);
        if (uRes.data) setRouteInterest(uRes.data);
    }, [today]);

    useEffect(() => {
        const saved = JSON.parse(localStorage.getItem('transport_user'));
        if (!saved || saved.role !== 'controller') {
            router.push('/');
            return;
        }
        setUser(saved);
        loadAllData();

        // বাসের লাইভ GPS অবস্থান প্রতি ৩ সেকেন্ড পরপর আপডেট করার জন্য
        const liveInterval = setInterval(async () => {
            const { data } = await supabase.from('buses').select('*, routes(*), users(*)').order('id');
            if (data) setBuses(data);
        }, 3000);

        return () => clearInterval(liveInterval);
    }, [router, loadAllData]);

    // এক্সট্রা বাস বা নতুন শিডিউল যোগ করা
    const handleAddSchedule = async (e) => {
        e.preventDefault();
        if (!newBusId || !newRouteId || !newTime) return;

        const { error } = await supabase.from('schedules').insert({
            bus_id: Number(newBusId),
            route_id: Number(newRouteId),
            departure_time: `${newTime}:00`,
        });

        if (!error) {
            setToast('নতুন বাস শিডিউল সফলভাবে যুক্ত হয়েছে!');
            setTimeout(() => setToast(''), 3000);
            loadAllData();
        }
    };

    // বাসের রুট বা ড্রাইভার পরিবর্তন করা
    const handleUpdateBus = async (busId, field, value) => {
        await supabase
            .from('buses')
            .update({ [field]: value || null })
            .eq('id', busId);

        setToast('বাসের তথ্য আপডেট করা হয়েছে!');
        setTimeout(() => setToast(''), 2500);
        loadAllData();
    };

    const formatTime = (timeStr) => {
        if (!timeStr) return '';
        const [h, m] = timeStr.split(':').map(Number);
        const ampm = h >= 12 ? 'PM' : 'AM';
        return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
    };

    if (!user) return null;

    const selectedBus = buses.find((b) => b.id === selectedBusId) || buses[0] || null;
    const driverInfo = selectedBus?.users || null;

    return (
        <div className="min-h-screen bg-slate-100 text-slate-800 pb-12 overflow-x-hidden">
            {/* স্টিকি হেডার */}
            <header className="sticky top-0 z-30 bg-slate-900 text-white px-4 sm:px-6 py-3.5 shadow flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className="bg-indigo-600 p-2 rounded-xl shrink-0">
                        <Bus size={20} />
                    </div>
                    <div className="truncate">
                        <h1 className="font-bold text-sm sm:text-lg truncate">Transport Controller Room</h1>
                        <p className="text-[11px] sm:text-xs text-slate-300 truncate">
                            {user.name} ({user.uni_id})
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <button
                        onClick={loadAllData}
                        className="flex items-center gap-1 bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded-xl text-xs font-semibold"
                    >
                        <RefreshCw size={14} />
                        <span className="hidden sm:inline">Refresh</span>
                    </button>
                    <button
                        onClick={() => {
                            localStorage.removeItem('transport_user');
                            router.push('/');
                        }}
                        className="flex items-center gap-1 bg-red-600 hover:bg-red-700 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold"
                    >
                        <LogOut size={15} />
                        <span>Logout</span>
                    </button>
                </div>
            </header>

            <main className="max-w-7xl mx-auto p-3.5 sm:p-6 space-y-6">
                {toast && (
                    <div className="bg-emerald-600 text-white px-4 py-3 rounded-xl text-sm font-semibold flex items-center gap-2 shadow">
                        <CheckCircle2 size={18} />
                        <span>{toast}</span>
                    </div>
                )}

                {/* ১. বাস নম্বর অনুযায়ী ড্রাইভার, হেল্পার ও লাইভ লোকেশন ডিটেইলস */}
                <section className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-200 space-y-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                            <h2 className="text-base sm:text-lg font-bold text-slate-800 flex items-center gap-2">
                                <Bus className="text-indigo-600 shrink-0" size={20} />
                                ১. বাস ও ড্রাইভারের বিস্তারিত তথ্য (বাস নম্বরে ক্লিক করো)
                            </h2>
                            <p className="text-xs text-slate-500 mt-0.5">
                                যেকোনো বাস নম্বরে ক্লিক করলে ড্রাইভার, হেল্পার এবং বাসের লাইভ অবস্থান দেখাবে
                            </p>
                        </div>
                    </div>

                    {/* ক্লিকযোগ্য বাস নম্বর বাটনসমূহ */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {buses.map((b) => {
                            const isSelected = selectedBus?.id === b.id;
                            return (
                                <button
                                    key={b.id}
                                    onClick={() => setSelectedBusId(b.id)}
                                    className={`p-3.5 rounded-2xl border-2 text-left transition active:scale-[0.98] ${isSelected
                                        ? 'border-indigo-600 bg-indigo-50 shadow-sm'
                                        : 'border-slate-200 bg-slate-50 hover:border-indigo-300'
                                        }`}
                                >
                                    <div className="flex items-center justify-between gap-1">
                                        <span className="font-bold text-base sm:text-lg text-slate-900">
                                            {b.bus_number}
                                        </span>
                                        <span
                                            className={`w-2.5 h-2.5 rounded-full ${b.is_active ? 'bg-emerald-500 animate-ping' : 'bg-slate-400'
                                                }`}
                                        ></span>
                                    </div>
                                    <p className="text-xs font-medium text-indigo-700 truncate mt-1">
                                        {b.routes?.route_name || 'রুট নির্ধারিত নেই'}
                                    </p>
                                    <p className="text-[11px] text-slate-500 truncate mt-0.5">
                                        ড্রাইভার: {b.users?.name || 'নেই'}
                                    </p>
                                </button>
                            );
                        })}
                    </div>

                    {/* নির্বাচিত বাসের সম্পূর্ণ প্রোফাইল ও লাইভ ম্যাপ */}
                    {selectedBus && (
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-2 border-t border-slate-200">
                            {/* বাম পাশে: ড্রাইভার ও হেল্পারের সব তথ্য */}
                            <div className="lg:col-span-6 space-y-4">
                                <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3.5">
                                    <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                                        <div>
                                            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
                                                নির্বাচিত বাস ও রুট
                                            </span>
                                            <h3 className="text-xl font-bold text-slate-900">
                                                {selectedBus.bus_number} — {selectedBus.routes?.route_name || 'No Route'}
                                            </h3>
                                        </div>
                                        <span
                                            className={`text-xs font-bold px-3 py-1 rounded-full ${selectedBus.is_active
                                                ? 'bg-emerald-100 text-emerald-800'
                                                : 'bg-slate-200 text-slate-600'
                                                }`}
                                        >
                                            {selectedBus.is_active ? 'Live On Road' : 'Standby'}
                                        </span>
                                    </div>

                                    {!driverInfo ? (
                                        <p className="text-sm text-amber-700 bg-amber-50 p-3 rounded-xl border border-amber-200">
                                            এই বাসে এখনো কোনো ড্রাইভার অ্যাসাইন করা হয়নি। নিচের ৪ নম্বর সেকশন থেকে ড্রাইভার যুক্ত করো।
                                        </p>
                                    ) : (
                                        <div className="space-y-3 text-sm">
                                            {/* ড্রাইভারের নাম ও আইডি */}
                                            <div className="flex items-start gap-3">
                                                <div className="p-2 rounded-lg bg-indigo-100 text-indigo-700 shrink-0">
                                                    <User size={18} />
                                                </div>
                                                <div>
                                                    <p className="text-xs text-slate-500">ড্রাইভারের নাম ও আইডি</p>
                                                    <p className="font-bold text-slate-900">
                                                        {driverInfo.name} ({driverInfo.uni_id})
                                                    </p>
                                                </div>
                                            </div>

                                            {/* ড্রাইভারের ফোন নম্বর */}
                                            <div className="flex items-start gap-3">
                                                <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700 shrink-0">
                                                    <Phone size={18} />
                                                </div>
                                                <div className="flex-1 flex flex-wrap items-center justify-between gap-2">
                                                    <div>
                                                        <p className="text-xs text-slate-500">ড্রাইভারের ফোন নম্বর</p>
                                                        <p className="font-bold text-slate-900">
                                                            {driverInfo.phone || 'দেওয়া হয়নি'}
                                                        </p>
                                                    </div>
                                                    {driverInfo.phone && (
                                                        <a
                                                            href={`tel:${driverInfo.phone}`}
                                                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition"
                                                        >
                                                            Call Driver
                                                        </a>
                                                    )}
                                                </div>
                                            </div>

                                            {/* ড্রাইভিং লাইসেন্স নম্বর */}
                                            <div className="flex items-start gap-3">
                                                <div className="p-2 rounded-lg bg-amber-100 text-amber-700 shrink-0">
                                                    <CreditCard size={18} />
                                                </div>
                                                <div>
                                                    <p className="text-xs text-slate-500">ড্রাইভিং লাইসেন্স নম্বর</p>
                                                    <p className="font-bold text-slate-900 font-mono">
                                                        {driverInfo.license_no || 'দেওয়া হয়নি'}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* বাড়ির ঠিকানা */}
                                            <div className="flex items-start gap-3">
                                                <div className="p-2 rounded-lg bg-blue-100 text-blue-700 shrink-0">
                                                    <Home size={18} />
                                                </div>
                                                <div>
                                                    <p className="text-xs text-slate-500">বাসার ঠিকানা (Home Address)</p>
                                                    <p className="font-semibold text-slate-800">
                                                        {driverInfo.address || 'দেওয়া হয়নি'}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* হেল্পারের নাম ও ফোন নম্বর */}
                                            <div className="mt-3 pt-3 border-t border-dashed border-slate-300 flex items-start gap-3">
                                                <div className="p-2 rounded-lg bg-purple-100 text-purple-700 shrink-0">
                                                    <UserCheck size={18} />
                                                </div>
                                                <div className="flex-1 flex flex-wrap items-center justify-between gap-2">
                                                    <div>
                                                        <p className="text-xs text-slate-500">সহকারী / হেল্পারের তথ্য</p>
                                                        <p className="font-bold text-slate-900">
                                                            {driverInfo.helper_name || 'হেল্পার যুক্ত নেই'}
                                                        </p>
                                                        <p className="text-xs font-semibold text-slate-600">
                                                            ফোন: {driverInfo.helper_phone || 'N/A'}
                                                        </p>
                                                    </div>
                                                    {driverInfo.helper_phone && (
                                                        <a
                                                            href={`tel:${driverInfo.helper_phone}`}
                                                            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-lg transition"
                                                        >
                                                            Call Helper
                                                        </a>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* ডান পাশে: নির্বাচিত বাসের লাইভ লোকেশন ম্যাপ */}
                            <div className="lg:col-span-6 space-y-2.5">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-bold text-sm sm:text-base text-slate-800 flex items-center gap-1.5">
                                        <Navigation className="text-emerald-600" size={18} />
                                        {selectedBus.bus_number}-এর লাইভ অবস্থান
                                    </h3>
                                    <span className="text-[11px] text-slate-400">প্রতি ৩ সেকেন্ডে আপডেট হয়</span>
                                </div>
                                <LiveBusMap
                                    bus={selectedBus}
                                    routeName={selectedBus.routes?.route_name}
                                />
                            </div>
                        </div>
                    )}
                </section>

                {/* ২. রুটভিত্তিক যাত্রী চাহিদা */}
                <section className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-200">
                    <h2 className="text-base sm:text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <Users className="text-indigo-600" size={20} />
                        ২. রুট অনুযায়ী স্টুডেন্ট চাহিদা ও আজকের বুকিং
                    </h2>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                        {routes.map((r) => {
                            const interestedStudents = routeInterest.filter(
                                (u) => u.selected_route_id === r.id
                            ).length;
                            const routeScheduleIds = schedules
                                .filter((s) => s.route_id === r.id)
                                .map((s) => s.id);
                            const confirmedCount = bookings.filter((b) =>
                                routeScheduleIds.includes(b.schedule_id)
                            ).length;

                            return (
                                <div
                                    key={r.id}
                                    className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col justify-between"
                                >
                                    <div>
                                        <p className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                                            <MapPin size={15} className="text-indigo-600 shrink-0" />
                                            {r.route_name}
                                        </p>
                                        <p className="text-xs text-slate-500 mt-2">
                                            রুট সিলেক্ট করেছে: <b className="text-slate-800">{interestedStudents} জন</b>
                                        </p>
                                        <p className="text-xs text-slate-500 mt-0.5">
                                            আজকে সিট বুক করেছে: <b className="text-emerald-700">{confirmedCount} জন</b>
                                        </p>
                                    </div>
                                    {confirmedCount >= 35 && (
                                        <span className="mt-3 inline-block text-[11px] font-bold bg-amber-100 text-amber-800 px-2 py-1 rounded-lg">
                                            যাত্রীর চাপ বেশি! এক্সট্রা বাস দিন
                                        </span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </section>

                {/* ৩. এক্সট্রা বাস বা নতুন সময়সূচি অ্যাসাইন করা */}
                <section className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-200">
                    <h2 className="text-base sm:text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <PlusCircle className="text-emerald-600" size={20} />
                        ৩. এক্সট্রা বাস / নতুন শিডিউল যোগ করো
                    </h2>

                    <form onSubmit={handleAddSchedule} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                        <select
                            value={newRouteId}
                            onChange={(e) => setNewRouteId(e.target.value)}
                            className="p-3 border border-slate-300 rounded-xl bg-slate-50 text-sm font-medium"
                            required
                        >
                            <option value="">রুট বেছে নাও</option>
                            {routes.map((r) => (
                                <option key={r.id} value={r.id}>{r.route_name}</option>
                            ))}
                        </select>

                        <select
                            value={newBusId}
                            onChange={(e) => setNewBusId(e.target.value)}
                            className="p-3 border border-slate-300 rounded-xl bg-slate-50 text-sm font-medium"
                            required
                        >
                            <option value="">বাস বেছে নাও</option>
                            {buses.map((b) => (
                                <option key={b.id} value={b.id}>{b.bus_number} ({b.total_seats} সিট)</option>
                            ))}
                        </select>

                        <input
                            type="time"
                            value={newTime}
                            onChange={(e) => setNewTime(e.target.value)}
                            className="p-3 border border-slate-300 rounded-xl bg-slate-50 text-sm font-medium"
                            required
                        />

                        <button
                            type="submit"
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl text-sm transition"
                        >
                            + শিডিউল যোগ করো
                        </button>
                    </form>
                </section>

                {/* ৪. চলমান শিডিউল ও সিট অকুপেন্সি */}
                <section className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-200">
                    <h2 className="text-base sm:text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <Clock className="text-indigo-600" size={20} />
                        ৪. আজকের সব বাস শিডিউল ও বুকিং অবস্থা
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                        {schedules.map((sch) => {
                            const bookedCount = bookings.filter((b) => b.schedule_id === sch.id).length;
                            const cap = sch.buses?.total_seats || 40;

                            return (
                                <div key={sch.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                                    <div className="flex justify-between items-center">
                                        <span className="font-bold text-base text-slate-800">
                                            {formatTime(sch.departure_time)}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSelectedBusId(sch.bus_id);
                                                window.scrollTo({ top: 0, behavior: 'smooth' });
                                            }}
                                            className="text-xs font-bold bg-slate-800 hover:bg-indigo-600 text-white px-2.5 py-1 rounded-lg transition"
                                        >
                                            {sch.buses?.bus_number} (তথ্য দেখো)
                                        </button>
                                    </div>
                                    <p className="text-xs font-semibold text-indigo-700">{sch.routes?.route_name}</p>
                                    <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                                        <div
                                            className="bg-emerald-600 h-full"
                                            style={{ width: `${Math.min(100, (bookedCount / cap) * 100)}%` }}
                                        ></div>
                                    </div>
                                    <p className="text-xs text-slate-600">
                                        বুকিং: <b>{bookedCount}</b> / {cap} সিট
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                </section>

                {/* ৫. বাসের রুট ও ড্রাইভার অ্যাসাইনমেন্ট */}
                <section className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-200">
                    <h2 className="text-base sm:text-lg font-bold text-slate-800 mb-4">
                        ৫. বাসের রুট ও ড্রাইভার পরিবর্তন করো
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {buses.map((b) => (
                            <div key={b.id} className="p-4 rounded-xl border border-slate-200 space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="font-bold text-base">{b.bus_number}</span>
                                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${b.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                                        {b.is_active ? 'Live On Road' : 'Standby'}
                                    </span>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                                    <div>
                                        <label className="block text-slate-500 mb-1">নির্ধারিত রুট</label>
                                        <select
                                            value={b.route_id || ''}
                                            onChange={(e) => handleUpdateBus(b.id, 'route_id', Number(e.target.value))}
                                            className="w-full p-2.5 border border-slate-300 rounded-lg bg-white font-medium"
                                        >
                                            <option value="">রুট নেই</option>
                                            {routes.map((r) => (
                                                <option key={r.id} value={r.id}>{r.route_name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-slate-500 mb-1">নির্ধারিত ড্রাইভার</label>
                                        <select
                                            value={b.driver_id || ''}
                                            onChange={(e) => handleUpdateBus(b.id, 'driver_id', Number(e.target.value))}
                                            className="w-full p-2.5 border border-slate-300 rounded-lg bg-white font-medium"
                                        >
                                            <option value="">ড্রাইভার নেই</option>
                                            {drivers.map((d) => (
                                                <option key={d.id} value={d.id}>{d.name} ({d.uni_id})</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            </main>
        </div>
    );
}