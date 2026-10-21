import { h } from './dom.js';

/* global L */

const START_CENTER = [34.05, -118.25]; // Los Angeles
// The whole world, once. Web Mercator tiles stop at about ±85° latitude.
const WORLD_BOUNDS = L.latLngBounds([-85.0511, -180], [85.0511, 180]);

function pinIcon(kind) {
  return L.divIcon({
    className: 'pin-icon',
    html: `<span class="pin pin--${kind}"></span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -26],
    tooltipAnchor: [12, -16],
  });
}

const ICONS = {
  saved: pinIcon('saved'),
  selected: pinIcon('selected'),
  draft: pinIcon('draft'),
  search: pinIcon('search'),
};

function labelFor(location) {
  return h('span', {}, location.name);
}

export function createMap(element, { onMapClick, onMarkerClick }) {
  const map = L.map(element, {
    center: START_CENTER,
    zoom: 10,
    minZoom: 2,
    maxBounds: WORLD_BOUNDS,
    maxBoundsViscosity: 1.0,
  });

  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    noWrap: true, // one copy of the world, so every click is a real longitude
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

  map.on('click', (e) => onMapClick(e.latlng.wrap()));

  const markers = new Map();
  let selectedId = null;
  let draftMarker = null;
  let searchMarker = null;

  function upsertMarker(location) {
    const existing = markers.get(location.id);
    if (existing) {
      existing.setTooltipContent(labelFor(location));
      existing.options.title = location.name;
      existing.getElement()?.setAttribute('title', location.name);
      return;
    }
    const marker = L.marker([location.lat, location.lng], {
      icon: location.id === selectedId ? ICONS.selected : ICONS.saved,
      keyboard: true,
      title: location.name,
    })
      .bindTooltip(labelFor(location), { direction: 'right' })
      .on('click', () => onMarkerClick(location.id))
      .addTo(map);
    markers.set(location.id, marker);
  }

  function removeMarker(id) {
    markers.get(id)?.remove();
    markers.delete(id);
    if (selectedId === id) selectedId = null;
  }

  function setSelected(id) {
    markers.get(selectedId)?.setIcon(ICONS.saved);
    selectedId = id;
    markers.get(id)?.setIcon(ICONS.selected);
  }

  function showDraft({ lat, lng }) {
    clearDraft();
    draftMarker = L.marker([lat, lng], { icon: ICONS.draft, interactive: false }).addTo(map);
  }

  function clearDraft() {
    draftMarker?.remove();
    draftMarker = null;
  }

  function showSearchResult(result, onBookmark) {
    clearSearchResult();
    const content = h('div', {},
      h('p', { class: 'popup-name' }, result.name),
      h('button', { type: 'button', class: 'btn btn-primary btn-small', onclick: onBookmark }, 'Bookmark this place'),
    );
    searchMarker = L.marker([result.lat, result.lng], { icon: ICONS.search })
      .bindPopup(content)
      .addTo(map);
    map.flyTo([result.lat, result.lng], Math.max(map.getZoom(), 15));
    map.once('moveend', () => searchMarker?.openPopup());
  }

  function clearSearchResult() {
    searchMarker?.remove();
    searchMarker = null;
  }

  function panTo({ lat, lng }) {
    if (!map.getBounds().pad(-0.1).contains([lat, lng])) map.panTo([lat, lng]);
  }

  // The visible area, clamped to the world, for biasing address search.
  function getViewbox() {
    const view = map.getBounds();
    return {
      west: Math.max(view.getWest(), -180),
      south: Math.max(view.getSouth(), -90),
      east: Math.min(view.getEast(), 180),
      north: Math.min(view.getNorth(), 90),
    };
  }

  return { getViewbox, upsertMarker, removeMarker, setSelected, showDraft, clearDraft, showSearchResult, clearSearchResult, panTo };
}
