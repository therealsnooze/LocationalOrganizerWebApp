import { api, setUnauthorizedHandler } from './api.js';
import { createAuthScreen } from './auth.js';
import { toast } from './dom.js';
import { createMap } from './map.js';
import { createPanel } from './panel.js';
import { initSearch } from './search.js';

const locations = new Map();
let selectedId = null;

const auth = createAuthScreen(document.getElementById('auth'));
const panel = createPanel(document.getElementById('panel'));
const map = createMap(document.getElementById('map'), {
  onMapClick: (latlng) => startDraft(latlng),
  onMarkerClick: (id) => select(id),
});

initSearch(
  {
    form: document.getElementById('search-form'),
    input: document.getElementById('search-input'),
    results: document.getElementById('search-results'),
  },
  {
    getViewbox: () => map.getViewbox(),
    onPick: (result) => map.showSearchResult(result, () => startDraft(result, result.name)),
  },
);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !e.target.closest('#search-form, #auth')) showWelcome();
});

// The session ran out mid-use: log back in, then reload so nothing stale is left on screen.
setUnauthorizedHandler(async () => {
  await auth.prompt('Your session expired. Log in again.');
  window.location.reload();
});

document.getElementById('logout-button').addEventListener('click', async () => {
  try {
    await api.logout();
  } catch (err) {
    toast(err.message);
    return;
  }
  window.location.reload();
});

function showAccount(user) {
  document.getElementById('account-name').textContent = user.username;
  document.getElementById('account').hidden = false;
}

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
  let user;
  try {
    ({ user } = await api.me());
  } catch (err) {
    toast(err.message);
    return;
  }
  user ??= await auth.prompt();
  showAccount(user);

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
