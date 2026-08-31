import { useEffect, useRef, useState } from 'react';
import { LocateFixedIcon, LoaderCircleIcon, TriangleAlertIcon } from 'lucide-react';

type LatLngTuple = [number, number];

declare global {
  interface Window {
    google?: any;
  }
}

const FALLBACK_CENTER: LatLngTuple = [40.7128, -74.006];

interface MapScreenProps {
  location: { latitude: number; longitude: number; accuracy: number } | null;
  updatedAt: Date | null;
}

export function MapScreen({ location, updatedAt }: MapScreenProps) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const circleRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const position: LatLngTuple | null = location ? [location.latitude, location.longitude] : null;
  const accuracy = location?.accuracy ?? null;
  const locationAccepted = Boolean(location);

  useEffect(() => {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
      setMapReady(false);
      return;
    }

    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
    const onLoad = () => setMapReady(true);

    if (existingScript) {
      if (window.google && window.google.maps) {
        setMapReady(true);
      } else {
        existingScript.addEventListener('load', onLoad, { once: true });
      }
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.addEventListener('load', onLoad, { once: true });
    script.addEventListener('error', () => {
      setError('Google Maps failed to load. Check your API key and billing configuration.');
    });
    document.head.appendChild(script);

    return () => {
      script.removeEventListener('load', onLoad);
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;

    if (!mapReady || !window.google?.maps) {
      return;
    }

    if (!mapInstance.current) {
      const map = new window.google.maps.Map(mapRef.current, {
        center: { lat: FALLBACK_CENTER[0], lng: FALLBACK_CENTER[1] },
        zoom: 17,
        mapTypeId: window.google.maps.MapTypeId.SATELLITE,
        disableDefaultUI: true,
        zoomControl: true,
        gestureHandling: 'greedy',
      });

      mapInstance.current = map;

      markerRef.current = new window.google.maps.Marker({
        map,
        title: 'My location',
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: '#10b981',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 3,
        },
      });

      circleRef.current = new window.google.maps.Circle({
        map,
        center: { lat: FALLBACK_CENTER[0], lng: FALLBACK_CENTER[1] },
        radius: 50,
        fillColor: '#10b981',
        fillOpacity: 0.12,
        strokeColor: '#10b981',
        strokeOpacity: 0.7,
        strokeWeight: 1,
      });
    }

    if (position) {
      const nextPosition = { lat: position[0], lng: position[1] };
      mapInstance.current.setCenter(nextPosition);
      mapInstance.current.setZoom(18);
      markerRef.current.setPosition(nextPosition);
      circleRef.current.setCenter(nextPosition);
      circleRef.current.setRadius(Math.max(accuracy ?? 40, 30));
    }
  }, [mapReady, position, accuracy]);

  const currentCenter = position ?? FALLBACK_CENTER;
  const liveStatus = locationAccepted && position ? 'Live' : 'Locating';

  return (
    <section className="flex h-full flex-col">
      <header className="flex items-start justify-between gap-4 px-5 pb-3 pt-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">Live map</h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            {locationAccepted && updatedAt
              ? `Updated ${updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
              : error
                ? 'Awaiting location approval'
                : 'Finding your position…'}
          </p>
        </div>

        <span
          className={`map-status-pill inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
            locationAccepted ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300'
          }`}
        >
          {locationAccepted ? (
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
          ) : (
            <LoaderCircleIcon className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          )}
          {liveStatus}
        </span>
      </header>

      {error && (
        <p className="mx-4 mb-3 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
          <TriangleAlertIcon className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      <div className="relative mx-4 mb-4 flex-1 overflow-hidden rounded-3xl border border-slate-200/80 shadow-sm dark:border-white/10">
        <div id="map" ref={mapRef} className="h-full w-full" />

        {!mapReady && (
          <div className="pointer-events-none absolute inset-0 overflow-hidden bg-[#26343a]">
            <div className="absolute inset-0 opacity-80 [background-image:linear-gradient(32deg,transparent_44%,rgba(238,220,169,0.55)_45%,rgba(238,220,169,0.55)_47%,transparent_48%),linear-gradient(118deg,transparent_46%,rgba(197,205,167,0.42)_47%,rgba(197,205,167,0.42)_52%,transparent_53%),radial-gradient(ellipse_at_25%_30%,#4f684e_0%,#344b41_42%,transparent_43%),radial-gradient(ellipse_at_78%_72%,#586949_0%,#344b41_38%,transparent_39%)]" />
            <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,0.24)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.24)_1px,transparent_1px)] [background-size:42px_42px]" />
            <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-slate-950/35" />
            <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2 rounded-2xl border border-white/25 bg-slate-950/45 px-4 py-3 text-center text-white shadow-xl backdrop-blur-sm">
              <span className="h-4 w-4 rounded-full border-4 border-white bg-violet-500 shadow-[0_0_0_8px_rgba(139,92,246,0.25)]" />
              <span className="text-sm font-semibold">Satellite preview</span>
              <span className="text-xs text-white/70">Add a Google Maps key for live imagery</span>
            </div>
          </div>
        )}

        <div className="pointer-events-none absolute inset-x-3 bottom-3 z-[1000] flex items-end justify-between gap-3">
          <div className="pointer-events-auto rounded-2xl border border-slate-200/80 bg-white/90 px-3.5 py-2.5 shadow-lg shadow-slate-900/5 backdrop-blur-md dark:border-white/10 dark:bg-slate-900/85">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Current position</p>
            <p className="mt-1 font-mono text-sm text-slate-900 dark:text-white">
              {currentCenter[0].toFixed(4)}, {currentCenter[1].toFixed(4)}
            </p>
            {accuracy && (
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">±{Math.round(accuracy)} m accuracy</p>
            )}
          </div>

          <span className="pointer-events-none flex h-11 w-11 items-center justify-center rounded-full border border-slate-200/80 bg-white/90 text-emerald-600 shadow-lg shadow-slate-900/5 backdrop-blur-md dark:border-white/10 dark:bg-slate-900/85 dark:text-emerald-400">
            <LocateFixedIcon className="h-5 w-5" aria-hidden="true" />
          </span>
        </div>
      </div>
    </section>
  );
}
