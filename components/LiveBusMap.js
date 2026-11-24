'use client';
import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';

export default function LiveBusMap({ bus, buses, routeName }) {
    const mapContainerRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const markersRef = useRef({});

    // একক বাস বা একাধিক বাসের লিস্ট প্রস্তুত করা
    const busList = buses && buses.length > 0 ? buses : bus ? [bus] : [];
    const defaultLat = busList[0]?.current_lat || 23.8768;
    const defaultLng = busList[0]?.current_lng || 90.3201;

    useEffect(() => {
        let isMounted = true;

        async function updateMap() {
            const L = (await import('leaflet')).default;
            if (!isMounted || !mapContainerRef.current) return;

            if (!mapInstanceRef.current) {
                const map = L.map(mapContainerRef.current).setView([defaultLat, defaultLng], buses ? 12 : 15);
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '&copy; OpenStreetMap',
                }).addTo(map);
                mapInstanceRef.current = map;
            }

            const map = mapInstanceRef.current;

            busList.forEach((b) => {
                const lat = b.current_lat || 23.8768;
                const lng = b.current_lng || 90.3201;
                const bg = b.is_active ? '#16a34a' : '#475569';

                const busIcon = L.divIcon({
                    className: 'custom-bus-marker',
                    html: `<div style="background:${bg};color:white;padding:5px 10px;border-radius:9999px;font-weight:bold;font-size:12px;border:2px solid white;box-shadow:0 3px 8px rgba(0,0,0,0.3);white-space:nowrap;">
                  🚌 ${b.bus_number}
                 </div>`,
                    iconSize: [84, 34],
                    iconAnchor: [42, 17],
                });

                if (markersRef.current[b.id]) {
                    markersRef.current[b.id].setLatLng([lat, lng]);
                    markersRef.current[b.id].setIcon(busIcon);
                } else {
                    const marker = L.marker([lat, lng], { icon: busIcon }).addTo(map);
                    marker.bindPopup(
                        `<b>${b.bus_number}</b><br/>রুট: ${b.routes?.route_name || routeName || 'Assigned Route'}<br/>অবস্থা: ${b.is_active ? 'লাইভ চলছে' : 'অফলাইন'}`
                    );
                    markersRef.current[b.id] = marker;
                }
            });

            // যদি সিঙ্গেল বাস হয়, তবে ক্যামেরা বাসের সাথে সাথে সরবে
            if (!buses && busList[0]) {
                map.panTo([busList[0].current_lat || defaultLat, busList[0].current_lng || defaultLng]);
            }
        }

        updateMap();

        return () => {
            isMounted = false;
        };
    }, [busList, buses, defaultLat, defaultLng, routeName]);

    useEffect(() => {
        return () => {
            if (mapInstanceRef.current) {
                mapInstanceRef.current.remove();
                mapInstanceRef.current = null;
                markersRef.current = {};
            }
        };
    }, []);

    return (
        <div className="relative w-full h-64 sm:h-80 md:h-96 rounded-2xl overflow-hidden border-2 border-slate-200 z-0">
            <div ref={mapContainerRef} className="w-full h-full" />
            <div className="absolute bottom-3 left-3 z-[400] bg-white/95 backdrop-blur px-3 py-1.5 rounded-xl shadow text-xs font-semibold text-slate-700 border border-slate-200">
                {buses ? (
                    <span>মোট বাস: {buses.length}টি • সবুজ = চলমান, ধূসর = স্ট্যান্ডবাই</span>
                ) : bus?.is_active ? (
                    <span className="flex items-center gap-1.5 text-emerald-700">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
                        লাইভ চলছে • {bus.bus_number}
                    </span>
                ) : (
                    <span className="text-slate-500">বাসটি এখন স্ট্যান্ডবাই (অফলাইন) অবস্থায় আছে</span>
                )}
            </div>
        </div>
    );
}