'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import LiveBusMap from '@/components/LiveBusMap';
import {
    ShieldCheck,
    Bus,
    MapPin,
    UserPlus,
    LogOut,
    CheckCircle2,
    Navigation,
} from 'lucide-react';

export default function AdminDashboard() {
    const [user, setUser] = useState(null);
    const [buses, setBuses] = useState([]);
    const [routes, setRoutes] = useState([]);
    const [usersList, setUsersList] = useState([]);
    const [toast, setToast] = useState('');

    // নতুন রুট ফর্ম
    const [routeName, setRouteName] = useState('');
    const [stoppagesText, setStoppagesText] = useState('');

    // নতুন বাস ফর্ম
    const [busNumber, setBusNumber] = useState('');
    const [totalSeats, setTotalSeats] = useState(40);

    // নতুন ইউজার ফর্ম (// demo - ভবিষ্যতে ভার্সিটির মূল ডাটাবেস থেকে অটো-সিঙ্ক হবে)
    const [newUniId, setNewUniId] = useState('');
    const [newName, setNewName] = useState('');
    const [newRole, setNewRole] = useState('student');
    const [newPass, setNewPass] = useState('1234');

    const router = useRouter();

    const fetchData = useCallback(async () => {
        const [bRes, rRes, uRes] = await Promise.all([
            supabase.from('buses').select('*, routes(*), users(*)').order('id'),
            supabase.from('routes').select('*').order('id'),
            supabase.from('users').select('*').order('role'),
        ]);

        if (bRes.data) setBuses(bRes.data);
        if (rRes.data) setRoutes(rRes.data);
        if (uRes.data) setUsersList(uRes.data);
    }, []);

    useEffect(() => {
        const saved = JSON.parse(localStorage.getItem('transport_user'));
        if (!saved || saved.role !== 'admin') {
            router.push('/');
            return;
        }
        setUser(saved);
        fetchData();

        // প্রতি ৪ সেকেন্ডে সব বাসের লাইভ লোকেশন রিফ্রেশ
        const interval = setInterval(fetchData, 4000);
        return () => clearInterval(interval);
    }, [router, fetchData]);

    const showToast = (msg) => {
        setToast(msg);
        setTimeout(() => setToast(''), 3000);
    };

    const handleCreateRoute = async (e) => {
        e.preventDefault();
        const stoppagesArray = stoppagesText
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);

        if (!routeName || stoppagesArray.length === 0) return;

        const { error } = await supabase.from('routes').insert({
            route_name: routeName.trim(),
            stoppages: stoppagesArray,
        });

        if (!error) {
            setRouteName('');
            setStoppagesText('');
            showToast('নতুন রুট যুক্ত হয়েছে!');
            fetchData();
        }
    };

    const handleCreateBus = async (e) => {
        e.preventDefault();
        if (!busNumber) return;

        const { error } = await supabase.from('buses').insert({
            bus_number: busNumber.trim(),
            total_seats: Number(totalSeats) || 40,
            current_lat: 23.8768,
            current_lng: 90.3201,
            is_active: false,
        });

        if (!error) {
            setBusNumber('');
            showToast('নতুন বাস ফ্লিটে যুক্ত হয়েছে!');
            fetchData();
        }
    };

    // demo
    const handleCreateUser = async (e) => {
        e.preventDefault();
        if (!newUniId || !newName) return;

        const { error } = await supabase.from('users').insert({
            uni_id: newUniId.trim().toUpperCase(),
            name: newName.trim(),
            password: newPass.trim() || '1234',
            role: newRole,
        });

        if (!error) {
            setNewUniId('');
            setNewName('');
            showToast('নতুন ইউজার অ্যাকাউন্ট তৈরি হয়েছে!');
            fetchData();
        }
    };
    // demo end

    if (!user) return null;

    const activeBusesCount = buses.filter((b) => b.is_active).length;

    return (
        <div className="min-h-screen bg-slate-100 text-slate-800 pb-12 overflow-x-hidden">
            {/* হেডার */}
            <header className="bg-slate-900 text-white px-4 sm:px-6 py-4 shadow flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                    <div className="bg-amber-500 text-slate-900 p-2 rounded-xl">
                        <ShieldCheck size={22} />
                    </div>
                    <div>
                        <h1 className="font-bold text-base sm:text-lg">University Head Admin</h1>
                        <p className="text-xs text-slate-300">{user.name} ({user.uni_id})</p>
                    </div>
                </div>

                <button
                    onClick={() => {
                        localStorage.removeItem('transport_user');
                        router.push('/');
                    }}
                    className="flex items-center gap-1 bg-red-600 hover:bg-red-700 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold"
                >
                    <LogOut size={15} />
                    Logout
                </button>
            </header>

            <main className="max-w-6xl mx-auto p-3.5 sm:p-6 space-y-6">
                {toast && (
                    <div className="bg-emerald-600 text-white px-4 py-3 rounded-xl text-sm font-semibold flex items-center gap-2 shadow">
                        <CheckCircle2 size={18} />
                        <span>{toast}</span>
                    </div>
                )}

                {/* ওভারভিউ কার্ডসমূহ */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
                        <p className="text-xs text-slate-500">মোট বাস</p>
                        <p className="text-2xl font-bold text-slate-800 mt-1">{buses.length}টি</p>
                    </div>
                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
                        <p className="text-xs text-slate-500">এখন রাস্তায় চলমান</p>
                        <p className="text-2xl font-bold text-emerald-600 mt-1">{activeBusesCount}টি</p>
                    </div>
                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
                        <p className="text-xs text-slate-500">মোট রুট</p>
                        <p className="text-2xl font-bold text-blue-600 mt-1">{routes.length}টি</p>
                    </div>
                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
                        <p className="text-xs text-slate-500">নিবন্ধিত ইউজার</p>
                        <p className="text-2xl font-bold text-indigo-600 mt-1">{usersList.length} জন</p>
                    </div>
                </div>

                {/* ১. সব বাসের লাইভ ফ্লিট ম্যাপ */}
                <section className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-200 space-y-3">
                    <h2 className="text-base sm:text-lg font-bold text-slate-800 flex items-center gap-2">
                        <Navigation className="text-emerald-600" size={20} />
                        সকল বাসের লাইভ অবস্থান (Live Fleet Map)
                    </h2>
                    <LiveBusMap buses={buses} />
                </section>

                {/* ২. নতুন রুট ও নতুন বাস যোগ করা (মোবাইলে উপরে-নিচে, ল্যাপটপে পাশাপাশি) */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <section className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-200">
                        <h2 className="text-base font-bold text-slate-800 mb-3 flex items-center gap-2">
                            <MapPin className="text-blue-600" size={18} />
                            নতুন রুট যোগ করো
                        </h2>
                        <form onSubmit={handleCreateRoute} className="space-y-3">
                            <input
                                type="text"
                                placeholder="রুটের নাম (যেমন: Mohammadpur Route)"
                                value={routeName}
                                onChange={(e) => setRouteName(e.target.value)}
                                className="w-full p-3 border border-slate-300 rounded-xl text-sm"
                                required
                            />
                            <input
                                type="text"
                                placeholder="স্টপেজসমূহ কমা দিয়ে লিখুন (Campus, Asad Gate, Shyamoli)"
                                value={stoppagesText}
                                onChange={(e) => setStoppagesText(e.target.value)}
                                className="w-full p-3 border border-slate-300 rounded-xl text-sm"
                                required
                            />
                            <button
                                type="submit"
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl text-sm"
                            >
                                + রুট সেভ করো
                            </button>
                        </form>
                    </section>

                    <section className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-200">
                        <h2 className="text-base font-bold text-slate-800 mb-3 flex items-center gap-2">
                            <Bus className="text-emerald-600" size={18} />
                            নতুন বাস যোগ করো
                        </h2>
                        <form onSubmit={handleCreateBus} className="space-y-3">
                            <input
                                type="text"
                                placeholder="বাস নম্বর (যেমন: Bus-05)"
                                value={busNumber}
                                onChange={(e) => setBusNumber(e.target.value)}
                                className="w-full p-3 border border-slate-300 rounded-xl text-sm"
                                required
                            />
                            <input
                                type="number"
                                placeholder="মোট সিট সংখ্যা (যেমন: 40)"
                                value={totalSeats}
                                onChange={(e) => setTotalSeats(e.target.value)}
                                className="w-full p-3 border border-slate-300 rounded-xl text-sm"
                                required
                            />
                            <button
                                type="submit"
                                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl text-sm"
                            >
                                + বাস যোগ করো
                            </button>
                        </form>
                    </section>
                </div>

                {/* demo */}
                {/* ৩. ইউজার / স্টাফ অ্যাকাউন্ট তৈরি (ভবিষ্যতে ভার্সিটির মূল ডাটাবেসের সাথে যুক্ত হবে) */}
                <section className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-200">
                    <h2 className="text-base font-bold text-slate-800 mb-3 flex items-center gap-2">
                        <UserPlus className="text-indigo-600" size={18} />
                        নতুন ইউজার / ড্রাইভার / কন্ট্রোলার তৈরি করো
                    </h2>
                    <form onSubmit={handleCreateUser} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                        <input
                            type="text"
                            placeholder="ID (যেমন: STU-105)"
                            value={newUniId}
                            onChange={(e) => setNewUniId(e.target.value)}
                            className="p-3 border border-slate-300 rounded-xl text-sm"
                            required
                        />
                        <input
                            type="text"
                            placeholder="পূর্ণ নাম"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            className="p-3 border border-slate-300 rounded-xl text-sm"
                            required
                        />
                        <select
                            value={newRole}
                            onChange={(e) => setNewRole(e.target.value)}
                            className="p-3 border border-slate-300 rounded-xl text-sm bg-white"
                        >
                            <option value="student">Student</option>
                            <option value="driver">Driver</option>
                            <option value="controller">Controller</option>
                            <option value="admin">Admin</option>
                        </select>
                        <input
                            type="text"
                            placeholder="Password (1234)"
                            value={newPass}
                            onChange={(e) => setNewPass(e.target.value)}
                            className="p-3 border border-slate-300 rounded-xl text-sm"
                        />
                        <button
                            type="submit"
                            className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 px-4 rounded-xl text-sm"
                        >
                            + ইউজার যোগ করো
                        </button>
                    </form>
                </section>
                {/* demo end */}
            </main>
        </div>
    );
}