"use client";

import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
// Leaflet-CSS wird global in src/app/layout.tsx geladen (vermeidet CSS-Chunk-404 im Dev).

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  kind?: "car" | "pickup" | "dest" | "driver";
  color?: string;
  label?: string;
  popup?: string;
}

interface MapProps {
  center: [number, number];
  zoom?: number;
  markers?: MapMarker[];
  line?: [number, number][];
  fit?: boolean;
  className?: string;
}

function makeIcon(m: MapMarker): L.DivIcon {
  if (m.kind === "car" || m.kind === "driver") {
    const color = m.color ?? "#f59e0b";
    return L.divIcon({
      className: "tc-marker",
      html: `<div style="display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,.35);font-size:18px">🚕</div>`,
      iconSize: [34, 34],
      iconAnchor: [17, 17],
    });
  }
  const isPickup = m.kind === "pickup";
  const color = m.color ?? (isPickup ? "#16a34a" : "#dc2626");
  const glyph = isPickup ? "A" : "B";
  return L.divIcon({
    className: "tc-marker",
    html: `<div style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${color};border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,.35)"><span style="transform:rotate(45deg);color:white;font-weight:700;font-size:13px">${glyph}</span></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
  });
}

function Recenter({ center, markers, fit }: { center: [number, number]; markers: MapMarker[]; fit?: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (fit && markers.length > 1) {
      const bounds = L.latLngBounds(markers.map((m) => [m.lat, m.lng] as [number, number]));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    } else {
      map.setView(center, map.getZoom());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center[0], center[1], fit, markers.length]);
  return null;
}

export default function Map({ center, zoom = 13, markers = [], line, fit, className }: MapProps) {
  const icons = useMemo(() => markers.map((m) => ({ m, icon: makeIcon(m) })), [markers]);

  return (
    <div className={className ?? "h-full w-full"}>
      <MapContainer center={center} zoom={zoom} scrollWheelZoom zoomControl className="h-full w-full">
        <TileLayer
          attribution='&copy; OpenStreetMap, &copy; CARTO'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
          maxZoom={20}
          detectRetina
        />
        {line && line.length > 1 && (
          <>
            <Polyline positions={line} pathOptions={{ color: "#ffffff", weight: 9, opacity: 0.9 }} />
            <Polyline positions={line} pathOptions={{ color: "#2563eb", weight: 5, opacity: 0.95 }} />
          </>
        )}
        {icons.map(({ m, icon }) => (
          <Marker key={m.id} position={[m.lat, m.lng]} icon={icon}>
            {(m.popup || m.label) && <Popup>{m.popup ?? m.label}</Popup>}
          </Marker>
        ))}
        <Recenter center={center} markers={markers} fit={fit} />
      </MapContainer>
    </div>
  );
}
