let onUnauthorized = () => {};

// Called when the session is missing or expired on any non-auth request.
export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

async function request(method, url, body) {
  const options = { method, headers: {} };
  if (body instanceof FormData) {
    options.body = body;
  } else if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(url, options);
  } catch {
    throw new Error('Could not reach the server. Is it running?');
  }

  if (response.status === 401 && !url.startsWith('/api/auth/')) onUnauthorized();
  if (response.status === 204) return null;
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || `Request failed (${response.status})`);
  return data;
}

export const api = {
  me: () => request('GET', '/api/auth/me'),
  register: (credentials) => request('POST', '/api/auth/register', credentials),
  login: (credentials) => request('POST', '/api/auth/login', credentials),
  logout: () => request('POST', '/api/auth/logout'),

  listLocations: () => request('GET', '/api/locations'),
  createLocation: (location) => request('POST', '/api/locations', location),
  updateLocation: (id, changes) => request('PUT', `/api/locations/${id}`, changes),
  deleteLocation: (id) => request('DELETE', `/api/locations/${id}`),

  listFiles: (locationId) => request('GET', `/api/locations/${locationId}/files`),
  uploadFile: (locationId, file) => {
    const form = new FormData();
    form.append('file', file);
    return request('POST', `/api/locations/${locationId}/files`, form);
  },
  deleteFile: (id) => request('DELETE', `/api/files/${id}`),
  fileUrl: (id) => `/api/files/${id}`,

  geocode: (query) => request('GET', `/api/geocode?${new URLSearchParams({ q: query })}`),
};
