"use client";

import { useEffect, useMemo } from "react";
import L from "leaflet";
import { MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet";
import type { LatLng } from "@/lib/types";

const OSM_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const OSM_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

/** Red map pin (divIcon — no bundled image assets needed). */
const incidentIcon = L.divIcon({
  className: "pin-marker",
  iconSize: [28, 38],
  iconAnchor: [14, 37],
  tooltipAnchor: [0, -32],
  html: `<svg width="28" height="38" viewBox="0 0 28 38" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M14 1C7 1 1.5 6.4 1.5 13.3 1.5 22.6 14 37 14 37s12.5-14.4 12.5-23.7C26.5 6.4 21 1 14 1z" fill="#E95B58" stroke="#fff" stroke-width="2"/>
    <circle cx="14" cy="13.5" r="5" fill="#fff"/></svg>`,
});

function ambulanceIcon(heading: number | null | undefined) {
  const rot = Number.isFinite(heading) ? Number(heading) : 0;
  // Top-down ambulance: the nose points up (north) and the whole marker is rotated by the heading.
  return L.divIcon({
    className: "amb-marker",
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    tooltipAnchor: [0, -18],
    html: `<div style="width:40px;height:40px;transform:rotate(${rot}deg);transition:transform .4s linear">
      <svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <circle cx="20" cy="20" r="18" fill="#fff" stroke="#E95B58" stroke-width="2"/>
        <path d="M20 4 L25 11 L15 11 Z" fill="#E95B58"/>
        <rect x="13" y="11" width="14" height="20" rx="3" fill="#fff" stroke="#3F3F3F" stroke-width="1.6"/>
        <rect x="14.5" y="12.5" width="11" height="4" rx="1" fill="#3F3F3F"/>
        <path d="M20 19.5v8M16 23.5h8" stroke="#E95B58" stroke-width="2.4" stroke-linecap="round"/>
      </svg></div>`,
  });
}

function FitBounds({ points }: { points: LatLng[] }) {
  const map = useMap();
  const key = points.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join("|");
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 15);
      return;
    }
    map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number])), { padding: [40, 40], maxZoom: 16 });
    // Only refit when the set of anchor points changes, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map]);
  return null;
}

/** Keeps the map sized correctly when its container appears inside panels. */
function InvalidateSize() {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 150);
    return () => clearTimeout(t);
  }, [map]);
  return null;
}

export function IncidentMap({ location, label }: { location: LatLng; label?: string | null }) {
  return (
    <MapContainer
      center={[location.lat, location.lng]}
      zoom={15}
      scrollWheelZoom={false}
      className="h-full w-full"
      attributionControl
    >
      <TileLayer url={OSM_URL} attribution={OSM_ATTR} />
      <InvalidateSize />
      <Marker position={[location.lat, location.lng]} icon={incidentIcon} alt="Lokasi kejadian">
        {label && <Tooltip direction="top">{label}</Tooltip>}
      </Marker>
    </MapContainer>
  );
}

export interface TrackingMapProps {
  incident: LatLng | null;
  ambulance: (LatLng & { heading?: number | null }) | null;
  route: LatLng[];
  ambulanceLabel?: string;
}

export function TrackingMap({ incident, ambulance, route, ambulanceLabel }: TrackingMapProps) {
  const center = ambulance ?? incident ?? route[route.length - 1] ?? { lat: -2.5489, lng: 118.0149 };
  const icon = useMemo(() => ambulanceIcon(ambulance?.heading), [ambulance?.heading]);
  const line = route.map((p) => [p.lat, p.lng] as [number, number]);
  if (ambulance && line.length > 0) line.push([ambulance.lat, ambulance.lng]);

  // Fit to incident + start of route + ambulance once per trip (not on every live update).
  const anchors: LatLng[] = [];
  if (incident) anchors.push(incident);
  if (route[0]) anchors.push(route[0]);
  if (anchors.length < 2 && ambulance) anchors.push(ambulance);

  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={incident || ambulance ? 14 : 5}
      className="h-full w-full"
      scrollWheelZoom
    >
      <TileLayer url={OSM_URL} attribution={OSM_ATTR} />
      <InvalidateSize />
      <FitBounds points={anchors} />
      {line.length > 1 && <Polyline positions={line} pathOptions={{ color: "#E95B58", weight: 4, opacity: 0.9 }} />}
      {incident && (
        <Marker position={[incident.lat, incident.lng]} icon={incidentIcon} alt="Lokasi kejadian">
          <Tooltip direction="top">Lokasi kejadian</Tooltip>
        </Marker>
      )}
      {ambulance && (
        <Marker position={[ambulance.lat, ambulance.lng]} icon={icon} alt="Posisi ambulans">
          <Tooltip direction="top">{ambulanceLabel ?? "Ambulans"}</Tooltip>
        </Marker>
      )}
    </MapContainer>
  );
}
