import { api } from './api.js';
import { toast } from './dom.js';
import { createMap } from './map.js';
import { createPanel } from './panel.js';
import { initSearch } from './search.js';

const locations = new Map();
let selectedId = null;

const panel = createPanel(document.getElementById('panel'));
const map = createMap(document.getElementById('map'), {
  onMapClick: (latlng, insideCounty) => {
    if (!insideCounty) {
      toast('Pick a spot inside LA County');
      return;
    }
    startDraft(latlng);
  },
  onMarkerClick: (id) => select(id),
});

initSearch(
  {
    form: document.getElementById('search-form'),
    input: document.getElementById('search-input'),
    results: document.getElementById('search-results'),
  },
  {
    onPick: (result) => map.showSearchResult(result, () => startDraft(result, result.name)),
  },
);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !e.target.closest('#search-form')) showWelcome();
});

function deselect() {
  selectedId = null;
  map.setSelected(null);
  map.clearDraft();
}

function showWelcome() {
  deselect();
  panel.showWelcome(locations.size);
}

function startDraft({ lat, lng }, name = '') {
  deselect();
  map.clearSearchResult();
  map.showDraft({ lat, lng });
  panel.showForm({
    title: 'New place',
    lat,
    lng,
    name,
    submitLabel: 'Save place',
    onSubmit: async ({ name, description }) => {
      const location = await api.createLocation({ name, description, lat, lng });
      map.clearDraft();
      locations.set(location.id, location);
      map.upsertMarker(location);
      toast('Place saved');
      await select(location.id);
    },
    onCancel: showWelcome,
  });
}

async function select(id) {
  const location = locations.get(id);
  if (!location) return;
  map.clearDraft();
  selectedId = id;
  map.setSelected(id);
  map.panTo(location);
  panel.showLoading(location);

  let files;
  try {
    files = await api.listFiles(id);
  } catch (err) {
    toast(err.message);
    if (selectedId === id) showWelcome();
    return;
  }
  if (selectedId !== id) return; // user moved on while loading

  panel.showDetail(location, files, {
    onEdit: () => startEdit(id),
    onDelete: async () => {
      await api.deleteLocation(id);
      locations.delete(id);
      map.removeMarker(id);
      toast('Place deleted');
      showWelcome();
    },
    onUpload: async (file) => {
      const record = await api.uploadFile(id, file);
      location.file_count += 1;
      return record;
    },
    onDeleteFile: async (fileId) => {
      await api.deleteFile(fileId);
      location.file_count -= 1;
    },
    onClose: showWelcome,
  });
}

function startEdit(id) {
  const location = locations.get(id);
  panel.showForm({
    title: 'Edit place',
    lat: location.lat,
    lng: location.lng,
    name: location.name,
    description: location.description,
    submitLabel: 'Save changes',
    onSubmit: async (changes) => {
      const updated = await api.updateLocation(id, changes);
      locations.set(id, updated);
      map.upsertMarker(updated);
      toast('Changes saved');
      await select(id);
    },
    onCancel: () => select(id),
  });
}

async function init() {
  try {
    for (const location of await api.listLocations()) {
      locations.set(location.id, location);
      map.upsertMarker(location);
    }
  } catch (err) {
    toast(err.message);
  }
  showWelcome();
}

init();
