/* Moving map underlay powered by Leaflet */

const MAP_CONFIG = Object.freeze({
  defaultZoom: 16,
  fallbackLatLng: [0, 0],
  tileUrl: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  tileAttribution: '&copy; OpenStreetMap contributors &copy; CARTO',
  boatIcon: Object.freeze({
    size: [64, 64],
    anchor: [32, 32],
    url: '/static/images/kilo-icon.svg'
  })
});

let mapInstance = null;
let boatMarker = null;
let pendingState = null;
let lastHeadingDeg = null;
let loggedLeafletWarning = false;

function ensureLeafletReady() {
  const ready = typeof L !== 'undefined';
  if (!ready && !loggedLeafletWarning) {
    console.warn('Leaflet not loaded; moving map layer disabled until it becomes available.');
    loggedLeafletWarning = true;
  }
  return ready;
}

function createBoatIcon() {
  return L.divIcon({
    className: 'boat-marker',
    html: `<img src="${MAP_CONFIG.boatIcon.url}" alt="Vessel position">`,
    iconSize: MAP_CONFIG.boatIcon.size,
    iconAnchor: MAP_CONFIG.boatIcon.anchor
  });
}

function rotateBoatMarker(deg) {
  if (!boatMarker) return;
  const el = boatMarker.getElement();
  if (!el) return;
  const img = el.querySelector('img');
  if (!img) return;
  const normalized = ((deg % 360) + 360) % 360;
  img.style.transform = `rotate(${normalized}deg)`;
}

function applyStateToMap({ lat, lng, heading }) {
  if (!mapInstance || !boatMarker) return;
  const coords = [lat, lng];
  const zoom = mapInstance.getZoom() || MAP_CONFIG.defaultZoom;

  boatMarker.setLatLng(coords);
  mapInstance.setView(coords, zoom, { animate: false });

  if (Number.isFinite(heading)) {
    lastHeadingDeg = heading;
    rotateBoatMarker(heading);
  } else if (Number.isFinite(lastHeadingDeg)) {
    rotateBoatMarker(lastHeadingDeg);
  }
}

export function initializeMovingMapLayer() {
  if (mapInstance) return;
  if (!ensureLeafletReady()) return;

  const container = document.getElementById('moving-map-layer');
  if (!container) {
    console.warn('Missing #moving-map-layer container; skipping map init.');
    return;
  }

  mapInstance = L.map(container, {
    attributionControl: false,
    zoomControl: false,
    dragging: false,
    scrollWheelZoom: false,
    doubleClickZoom: false,
    boxZoom: false,
    keyboard: false,
    touchZoom: false,
    zoomSnap: 0.25
  });

  L.tileLayer(MAP_CONFIG.tileUrl, {
    minZoom: 3,
    maxZoom: 20,
    attribution: MAP_CONFIG.tileAttribution
  }).addTo(mapInstance);

  boatMarker = L.marker(MAP_CONFIG.fallbackLatLng, {
    icon: createBoatIcon(),
    interactive: false,
    keyboard: false
  }).addTo(mapInstance);

  mapInstance.setView(MAP_CONFIG.fallbackLatLng, MAP_CONFIG.defaultZoom, { animate: false });

  if (pendingState) {
    applyStateToMap(pendingState);
    pendingState = null;
  }
}

export function updateMapFromMavlink(msg = {}) {
  const lat = Number(msg.gps_lat_deg);
  const lng = Number(msg.gps_lng_deg);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return;
  }

  const headingRaw = Number(msg.heading_deg ?? msg.imu_yaw_deg);
  const heading = Number.isFinite(headingRaw) ? headingRaw : null;
  const state = { lat, lng, heading };

  if (!mapInstance || !boatMarker) {
    pendingState = state;
    return;
  }

  applyStateToMap(state);
}

export function invalidateMovingMapSize() {
  if (!mapInstance) return;
  // Defer to next frame to let layout/style changes settle before resizing
  requestAnimationFrame(() => {
    try {
      mapInstance.invalidateSize(false);
    } catch (err) {
      console.warn('Failed to invalidate map size', err);
    }
  });
}
