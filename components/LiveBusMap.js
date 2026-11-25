'use client';
import { useEffect, useRef } from 'react';

/**
 * Interactive OpenStreetMap + Leaflet Live Fleet Tracker
 * - Shows ALL buses simultaneously on one map (when selectedBusId is null)
 * - Focuses & tracks a single SELECTED bus live (when selectedBusId is provided)
 * - Draws route polyline & stoppage markers for the selected route
 *
 * [DIU INTEGRATION POINT #4 — HARDWARE GPS TELEMETRY]
 * Currently reads live `current_lat`, `current_lng`, and `speed_kmh` updated via
 * Driver App / Supabase polling. In DIU production, connect DIU Bus GPS hardware
 * webhooks to update the `buses` table every 5 seconds.
 */
export default function LiveBusMap({
  buses = [],
  routes = [],
  selectedBusId = null,
  height = '340px',
  onSelectBus,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const leafletRef = useRef(null);
  const markersLayerRef = useRef(null);
  const routeLayerRef = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !containerRef.current) return;

    // Inject Leaflet CSS safely once
    if (!document.getElementById('leaflet-cdn-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-cdn-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    let cancelled = false;

    async function initMap() {
      const L = (await import('leaflet')).default;
      if (cancelled || !containerRef.current) return;
      leafletRef.current = L;

      if (!mapRef.current) {
        mapRef.current = L.map(containerRef.current, {
          center: [23.8769, 90.3202], // DIU Smart City, Ashulia
          zoom: 12,
          zoomControl: true,
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap | DIU Smart Transport',
          maxZoom: 18,
        }).addTo(mapRef.current);

        routeLayerRef.current = L.layerGroup().addTo(mapRef.current);
        markersLayerRef.current = L.layerGroup().addTo(mapRef.current);
      }

      renderLayers();
    }

    function renderLayers() {
      const L = leafletRef.current;
      const map = mapRef.current;
      if (!L || !map || !markersLayerRef.current || !routeLayerRef.current) return;

      markersLayerRef.current.clearLayers();
      routeLayerRef.current.clearLayers();

      // Always pin DIU Ashulia Campus
      const diuIcon = L.divIcon({
        className: 'diu-campus-pin',
        html: `<div style="background:#1e293b;color:#fff;padding:4px 9px;border-radius:999px;font-size:11px;font-weight:700;border:2px solid #fff;box-shadow:0 4px 12px rgba(0,0,0,0.28);white-space:nowrap;">🎓 DIU Smart City</div>`,
        iconSize: [120, 26],
        iconAnchor: [60, 13],
      });
      L.marker([23.8769, 90.3202], { icon: diuIcon }).addTo(routeLayerRef.current);

      const selectedBus = selectedBusId
        ? buses.find((b) => Number(b.id) === Number(selectedBusId))
        : null;

      // Draw Route Polyline & Stoppages for Selected Bus
      if (selectedBus) {
        const route = routes.find((r) => Number(r.id) === Number(selectedBus.route_id));
        const stoppages = Array.isArray(route?.stoppages) ? route.stoppages : [];
        const coords = stoppages
          .filter((s) => s.lat && s.lng)
          .map((s) => [Number(s.lat), Number(s.lng)]);

        if (coords.length >= 2) {
          L.polyline(coords, {
            color: '#475569',
            weight: 4,
            opacity: 0.7,
            dashArray: '8, 6',
          }).addTo(routeLayerRef.current);
        }

        stoppages.forEach((s, idx) => {
          if (!s.lat || !s.lng) return;
          L.circleMarker([Number(s.lat), Number(s.lng)], {
            radius: 6,
            fillColor: '#64748b',
            color: '#ffffff',
            weight: 2,
            fillOpacity: 0.95,
          })
            .bindPopup(`<b>Stop #${idx + 1}: ${s.name}</b><br/>ETA Offset: +${s.offset_min || 0} min`)
            .addTo(routeLayerRef.current);
        });
      }

      // Render Bus Markers
      const visibleBuses = selectedBus ? [selectedBus] : buses;
      const bounds = [];

      visibleBuses.forEach((bus) => {
        const lat = Number(bus.current_lat) || 23.8769;
        const lng = Number(bus.current_lng) || 90.3202;
        bounds.push([lat, lng]);

        const route = routes.find((r) => Number(r.id) === Number(bus.route_id));
        const isActive = bus.status === 'active';
        const bg = isActive ? '#0f172a' : '#64748b';
        const dot = isActive ? '#22c55e' : '#f59e0b';

        const busIcon = L.divIcon({
          className: 'custom-bus-marker',
          html: `
            <div style="display:flex;align-items:center;gap:5px;background:${bg};color:#fff;padding:5px 10px;border-radius:999px;font-size:11px;font-weight:700;border:2px solid rgba(255,255,255,0.9);box-shadow:0 6px 18px rgba(15,23,42,0.35);white-space:nowrap;">
              <span style="width:8px;height:8px;border-radius:999px;background:${dot};display:inline-block;"></span>
              🚌 ${bus.bus_number}
            </div>
          `,
          iconSize: [96, 28],
          iconAnchor: [48, 14],
        });

        const marker = L.marker([lat, lng], { icon: busIcon }).addTo(markersLayerRef.current);
        marker.bindPopup(`
          <div style="font-size:12px;line-height:1.5;">
            <b>${bus.bus_number}</b> (${bus.plate_no || 'DIU Fleet'})<br/>
            <b>Route:</b> ${route?.name || 'Unassigned'}<br/>
            <b>Status:</b> ${isActive ? '🟢 Live Moving' : '🟡 Standby'}<br/>
            <b>Speed:</b> ${bus.speed_kmh || 0} km/h<br/>
            <b>GPS:</b> ${lat.toFixed(4)}, ${lng.toFixed(4)}
          </div>
        `);

        if (onSelectBus) {
          marker.on('click', () => onSelectBus(bus));
        }
      });

      if (selectedBus) {
        map.flyTo([Number(selectedBus.current_lat) || 23.8769, Number(selectedBus.current_lng) || 90.3202], 14, {
          duration: 0.7,
        });
      } else if (bounds.length > 1) {
        map.fitBounds(bounds, { padding: [36, 36], maxZoom: 13 });
      }
    }

    initMap();

    return () => {
      cancelled = true;
    };
  }, [buses, routes, selectedBusId, onSelectBus]);

  // Cleanup map only on full unmount
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border border-white/60 dark:border-white/10 shadow-inner">
      <div ref={containerRef} style={{ height, width: '100%' }} />
      <div className="absolute bottom-3 left-3 z-[400] glass-card px-3 py-1.5 text-[11px] font-semibold text-slate-700 dark:text-slate-200 pointer-events-none">
        {selectedBusId
          ? `Tracking Selected Bus Live • ${buses.find((b) => Number(b.id) === Number(selectedBusId))?.bus_number || ''}`
          : `All Fleet Live View • ${buses.length} Buses`}
      </div>
    </div>
  );
}
