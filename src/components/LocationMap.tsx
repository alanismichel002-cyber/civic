// Loaded lazily so Leaflet doesn't slow down the first page load.
import "leaflet/dist/leaflet.css";
import { useEffect, useMemo } from "react";
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from "react-leaflet";
import { latLngBounds } from "leaflet";
import type { VotingLocation } from "../../shared/types.ts";
import { softCase } from "../lib/format.ts";

interface Props {
  locations: VotingLocation[];
  origin?: { lat: number; lng: number };
  label: string;
  youLabel: string;
}

const COLORS: Record<VotingLocation["kind"], string> = {
  polling: "#1d4ed8",
  early: "#047857",
  dropoff: "#b45309",
};

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    // No animation: an in-flight zoom animation throws if the map unmounts mid-way.
    if (points.length === 1) map.setView(points[0], 15, { animate: false });
    else if (points.length > 1) map.fitBounds(latLngBounds(points), { padding: [28, 28], maxZoom: 16, animate: false });
  }, [map, points]);
  return null;
}

export default function LocationMap({ locations, origin, label, youLabel }: Props) {
  const withCoords = useMemo(() => locations.filter((l) => l.lat !== undefined && l.lng !== undefined), [locations]);
  const points = useMemo(() => {
    const p: [number, number][] = withCoords.map((l) => [l.lat!, l.lng!]);
    if (origin) p.push([origin.lat, origin.lng]);
    return p;
  }, [withCoords, origin]);
  if (!points.length) return null;

  return (
    // The map is supplementary: every location is also listed in text below it.
    <div role="img" aria-label={label} className="h-64 overflow-hidden rounded-xl border border-slate-200 sm:h-80 dark:border-slate-700">
      <MapContainer center={points[0]} zoom={14} zoomAnimation={false} fadeAnimation={false} markerZoomAnimation={false} scrollWheelZoom={false} style={{ height: "100%", width: "100%" }} keyboard={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        <FitBounds points={points} />
        {origin && (
          <CircleMarker center={[origin.lat, origin.lng]} radius={7} pathOptions={{ color: "#111827", fillColor: "#111827", fillOpacity: 1 }}>
            <Tooltip>{youLabel}</Tooltip>
          </CircleMarker>
        )}
        {withCoords.map((l, i) => (
          <CircleMarker
            key={l.id}
            center={[l.lat!, l.lng!]}
            radius={i === 0 ? 11 : 8}
            pathOptions={{ color: "#fff", weight: 2, fillColor: COLORS[l.kind], fillOpacity: 0.95 }}
          >
            <Tooltip>{softCase(l.name) || softCase(l.address.line1)}</Tooltip>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
