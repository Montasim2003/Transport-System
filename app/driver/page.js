'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import LiveBusMap from '@/components/LiveBusMap';
import {
    Bus,
    Navigation,
    Square,
    LogOut,
    Users,
    MapPin,
    Play,
    AlertCircle,
} from 'lucide-react';

export default function DriverDashboard() {
    const [user, setUser] = useState(null);
    const [bus, setBus] = useState(null);
    const [route, setRoute] = useState(null);
    const [todayBookingsCount, setTodayBookingsCount] = useState(0);
    const [isTracking, setIsTracking] = useState(false);
    const [isSimulating, setIsSimulating] = useState(false);
    const [statusMsg, setStatusMsg] = useState('');

    const watchIdRef = useRef(null);
    const simIntervalRef = useRef(null);
    const router = useRouter();
    const today = new Date().toISOString().split('T')[0];

    useEffect(() => {
        const saved = JSON.parse(localStorage.getItem('transport_user'));
        if (!saved || saved.role !== 'driver') {
            router.push('/');
            return;
        }
        setUser(saved);

        async function loadDriverBus() {
            const { data: busData } = await supabase
                .from('buses')
                .select('*, routes(*)')
                .eq('driver_id', saved.id)
                .single();

            if (busData) {
                setBus(busData);
                setRoute(busData.routes);
                setIsTracking(busData.is_active);

                const { data: schList } = await supabase
                    .from('schedules')
                    .select('id')
                    .eq('bus_id', busData.id);

                if (schList && schList.length > 0) {
                    const schIds = schList.map((s) => s.id);
                    const { count } = await supabase
                        .from('bookings')
                        .select('*', { count: 'exact', head: true })
                        .in('schedule_id', schIds)
                        .eq('booking_date', today);

                    setTodayBookingsCount(count || 0);
                }
            }
        }

        loadDriverBus();
    }, [router, today]);

    const startRealGpsTrip = async () => {
        if (!bus) return;
        setStatusMsg('');

        if (!('geolocation' in navigator)) {
            setStatusMsg('তোমার ব্রাউজারে GPS সাপোর্ট নেই। নিচের Demo Simulate বাটন ব্যবহার করো।');
            return;
        }

        setIsTracking(true);
        await supabase.from('buses').update({ is_active: true }).eq('id', bus.id);
        setBus((prev) => ({ ...prev, is_active: true }));

        watchIdRef.current = navigator.geolocation.watchPosition(
            async (pos) => {
                const { latitude, longitude } = pos.coords;
                await supabase
                    .from('buses')
                    .update({
                        current_lat: latitude,
                        current_lng: longitude,
                        is_active: true,
                        last_updated: new Date().toISOString(),
                    })
                    .eq('id', bus.id);

                setBus((prev) => ({
                    ...prev,
                    current_lat: latitude,
                    current_lng: longitude,
                    is_active: true,
                }));
            },
            () => {
                setStatusMsg('মোবাইলের Location পারমিশন অন করো অথবা Demo Move বাটন চাপো।');
            },
            { enableHighAccuracy: true, maximumAge: 3000 }
        );
    };

    const stopTrip = async () => {
        if (watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
        }
        if (simIntervalRef.current) {
            clearInterval(simIntervalRef.current);
            simIntervalRef.current = null;
        }

        setIsTracking(false);
        setIsSimulating(false);

        if (bus) {
            await supabase.from('buses').update({ is_active: false }).eq('id', bus.id);
            setBus((prev) => ({ ...prev, is_active: false }));
        }
    };

    // demo
    // স্যারদের দেখানোর জন্য রুমে বসেই বাসকে ম্যাপে চালানোর সিমুলেশন
    const toggleDemoSimulation = async () => {
        if (!bus) return;

        if (isSimulating) {
            clearInterval(simIntervalRef.current);
            simIntervalRef.current = null;
            setIsSimulating(false);
            return;
        }

        setIsSimulating(true);
        setIsTracking(true);
        let currentLat = bus.current_lat || 23.8768;
        let currentLng = bus.current_lng || 90.3201;

        await supabase.from('buses').update({ is_active: true }).eq('id', bus.id);

        simIntervalRef.current = setInterval(async () => {
            currentLat += 0.0004;
            currentLng += 0.0005;

            await supabase
                .from('buses')
                .update({
                    current_lat: currentLat,
                    current_lng: currentLng,
                    is_active: true,
                    last_updated: new Date().toISOString(),
                })
                .eq('id', bus.id);

            setBus((prev) => ({
                ...prev,
                current_lat: currentLat,
                current_lng: currentLng,
                is_active: true,
            }));
        }, 2000);
    };
    // demo end

    useEffect(() => {
        return () => {
            if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
            if (simIntervalRef.current) clearInterval(simIntervalRef.current);
        };
    }, []);

    if (!user) return null;

    return (
        <div className="min-h-screen bg-slate-100 text-slate-800 pb-10 overflow-x-hidden">
            {/* স্টিকি মোবাইল ও ল্যাপটপ ফ্রেন্ডলি হেডার */}
            <header className="sticky top-0 z-30 bg-slate-900 text-white px-4 sm:px-6 py-3.5 shadow flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className="bg-emerald-600 p-2 rounded-xl shrink-0">
                        <Bus size={20} />
                    </div>
                    <div className="truncate">
                        <h1 className="font-bold text-sm sm:text-lg leading-tight truncate">
                            Driver GPS Panel
                        </h1>
                        <p className="text-[11px] sm:text-xs text-slate-300 truncate">
                            {user.name} • {user.uni_id}
                        </p>
                    </div>
                </div>

                <button
                    onClick={() => {
                        stopTrip();
                        localStorage.removeItem('transport_user');
                        router.push('/');
                    }}
                    className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold shrink-0"
                >
                    <LogOut size={15} />
                    <span>Logout</span>
                </button>
            </header>

            {/* মেইন কন্টেইনার: মোবাইলে উপরে-নিচে, ল্যাপটপে পাশাপাশি ২ কলাম */}
            <main className="max-w-7xl mx-auto p-3.5 sm:p-6">
                {!bus ? (
                    <div className="bg-white p-6 rounded-2xl shadow-sm text-center text-slate-500">
                        তোমার আইডিতে এখনো কোনো বাস অ্যাসাইন করা হয়নি।
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                        {/* বাম কলাম (ল্যাপটপে ৫ ভাগ): বাসের তথ্য, ট্রিপ বাটন ও স্টপেজ লিস্ট */}
                        <div className="lg:col-span-5 space-y-5">
                            {/* কুইক স্ট্যাটাস কার্ড */}
                            <div className="grid grid-cols-2 gap-3.5">
                                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
                                    <p className="text-xs text-slate-500">নির্ধারিত বাস</p>
                                    <p className="text-xl sm:text-2xl font-bold text-slate-800 mt-1">
                                        {bus.bus_number}
                                    </p>
                                    <p className="text-xs text-blue-600 font-semibold mt-1 flex items-center gap-1 truncate">
                                        <MapPin size={13} className="shrink-0" />
                                        <span className="truncate">{route?.route_name}</span>
                                    </p>
                                </div>

                                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
                                    <p className="text-xs text-slate-500">আজকের বুকড যাত্রী</p>
                                    <p className="text-xl sm:text-2xl font-bold text-emerald-600 mt-1 flex items-center gap-1.5">
                                        <Users size={20} />
                                        {todayBookingsCount}/{bus.total_seats}
                                    </p>
                                    <span
                                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold mt-1.5 ${isTracking
                                            ? 'bg-emerald-100 text-emerald-800'
                                            : 'bg-slate-200 text-slate-600'
                                            }`}
                                    >
                                        <span
                                            className={`w-2 h-2 rounded-full ${isTracking ? 'bg-emerald-600 animate-pulse' : 'bg-slate-500'
                                                }`}
                                        ></span>
                                        {isTracking ? 'GPS Live' : 'Offline'}
                                    </span>
                                </div>
                            </div>

                            {/* বড় টাচ-ফ্রেন্ডলি ট্রিপ কন্ট্রোল বাটন */}
                            <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-200 space-y-3">
                                <h2 className="font-bold text-base text-slate-800">ট্রিপ কন্ট্রোল</h2>

                                {statusMsg && (
                                    <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs flex items-center gap-2">
                                        <AlertCircle size={16} className="shrink-0" />
                                        <span>{statusMsg}</span>
                                    </div>
                                )}

                                <div className="space-y-3">
                                    {!isTracking ? (
                                        <button
                                            onClick={startRealGpsTrip}
                                            className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-bold rounded-2xl shadow flex items-center justify-center gap-2 text-base transition"
                                        >
                                            <Navigation size={20} />
                                            Start Trip (লাইভ GPS চালু)
                                        </button>
                                    ) : (
                                        <button
                                            onClick={stopTrip}
                                            className="w-full py-4 bg-red-600 hover:bg-red-700 active:scale-[0.98] text-white font-bold rounded-2xl shadow flex items-center justify-center gap-2 text-base transition"
                                        >
                                            <Square size={20} />
                                            End Trip (ট্রিপ শেষ করো)
                                        </button>
                                    )}

                                    {/* demo */}
                                    <button
                                        onClick={toggleDemoSimulation}
                                        className={`w-full py-3.5 font-bold rounded-2xl border-2 flex items-center justify-center gap-2 text-sm sm:text-base transition active:scale-[0.98] ${isSimulating
                                            ? 'bg-amber-500 border-amber-600 text-slate-900'
                                            : 'bg-slate-50 border-slate-300 text-slate-700 hover:bg-slate-100'
                                            }`}
                                    >
                                        <Play size={18} />
                                        {isSimulating ? 'Demo Bus Moving (থামাও)' : 'Demo: বাস চালিয়ে দেখাও'}
                                    </button>
                                    {/* demo end */}
                                </div>
                            </div>

                            {/* ড্রাইভারের রুটের স্টপেজ তালিকা */}
                            {route?.stoppages && (
                                <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-200">
                                    <p className="text-xs font-bold text-slate-500 mb-2.5">নির্ধারিত রুটের স্টপেজসমূহ:</p>
                                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                                        {route.stoppages.map((stop, idx) => (
                                            <span key={idx} className="flex items-center gap-1">
                                                <span className="bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 font-semibold text-slate-700">
                                                    {stop}
                                                </span>
                                                {idx < route.stoppages.length - 1 && (
                                                    <span className="text-slate-400">→</span>
                                                )}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* ডান কলাম (ল্যাপটপে ৭ ভাগ): লাইভ ম্যাপ প্রিভিউ */}
                        <div className="lg:col-span-7 bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-200 space-y-3">
                            <h2 className="font-bold text-base sm:text-lg text-slate-800">
                                তোমার বাসের লাইভ অবস্থান
                            </h2>
                            <LiveBusMap bus={bus} routeName={route?.route_name} />
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}