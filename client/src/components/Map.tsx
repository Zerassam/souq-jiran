import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { cn } from "@/lib/utils";

export type MapPosition = { lat: number; lng: number };

export type MapMarker = {
  id: string;
  position: MapPosition;
  title: string;
  onClick?: () => void;
};

interface MapViewProps {
  className?: string;
  initialCenter?: MapPosition;
  initialZoom?: number;
  markers?: MapMarker[];
  onMapReady?: (map: L.Map) => void;
  onMapError?: (error: Error) => void;
}

/**
 * خريطة تفاعلية مبنية على Leaflet وبلاطات OpenStreetMap العامة. لا تحتاج إلى
 * مفتاح Google Maps في المتصفح، لذلك لا تتأثر بقيود مفاتيح Google JavaScript API.
 */
export function MapView({
  className,
  initialCenter = { lat: 28.0339, lng: 1.6596 },
  initialZoom = 5,
  markers = [],
  onMapReady,
  onMapError,
}: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerLayerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    try {
      const map = L.map(mapContainer.current, {
        zoomControl: true,
        attributionControl: true,
      }).setView([initialCenter.lat, initialCenter.lng], initialZoom);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(map);

      mapRef.current = map;
      markerLayerRef.current = L.layerGroup().addTo(map);
      onMapReady?.(map);

      return () => {
        map.remove();
        mapRef.current = null;
        markerLayerRef.current = null;
      };
    } catch (error) {
      onMapError?.(error instanceof Error ? error : new Error("تعذر تهيئة الخريطة"));
    }
  }, [initialCenter.lat, initialCenter.lng, initialZoom, onMapError, onMapReady]);

  useEffect(() => {
    const map = mapRef.current;
    const markerLayer = markerLayerRef.current;
    if (!map || !markerLayer) return;

    markerLayer.clearLayers();
    if (markers.length === 0) return;

    const bounds = L.latLngBounds([]);
    markers.forEach((item) => {
      const marker = L.marker([item.position.lat, item.position.lng], {
        title: item.title,
        icon: L.divIcon({
          className: "souq-jiran-map-marker",
          html: '<span style="display:block;width:28px;height:28px;border-radius:999px;background:#147b78;border:3px solid #ffffff;box-shadow:0 3px 9px rgba(20,123,120,.38)"></span>',
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        }),
      });
      marker.bindTooltip(item.title, { direction: "top", offset: [0, -14] });
      if (item.onClick) marker.on("click", item.onClick);
      marker.addTo(markerLayer);
      bounds.extend(marker.getLatLng());
    });

    if (markers.length === 1) {
      const position = markers[0].position;
      map.setView([position.lat, position.lng], Math.max(map.getZoom(), 12));
    } else {
      map.fitBounds(bounds, { padding: [32, 32], maxZoom: 12 });
    }
  }, [markers]);

  return <div ref={mapContainer} className={cn("w-full h-[500px]", className)} />;
}
