const express = require('express');
const { BOUNDS } = require('../config');
const { HttpError } = require('../http-error');

const router = express.Router();

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
// Nominatim's usage policy requires an identifying User-Agent.
const USER_AGENT = 'LocationalOrganizerPoC/1.0 (local development)';
const MIN_INTERVAL_MS = 1000; // policy: at most 1 request per second

let lastRequestAt = 0;

router.get('/', async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (!q) throw new HttpError(400, 'Query "q" is required');
  if (q.length > 200) throw new HttpError(400, 'Query is too long');

  const now = Date.now();
  if (now - lastRequestAt < MIN_INTERVAL_MS) {
    throw new HttpError(429, 'Searching too fast, try again in a second');
  }
  lastRequestAt = now;

  const params = new URLSearchParams({
    q,
    format: 'jsonv2',
    limit: '5',
    countrycodes: 'us',
    viewbox: `${BOUNDS.west},${BOUNDS.north},${BOUNDS.east},${BOUNDS.south}`,
    bounded: '1',
  });

  let response;
  try {
    response = await fetch(`${NOMINATIM_URL}?${params}`, {
      headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'en' },
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new HttpError(502, 'Address search service is unreachable');
  }
  if (!response.ok) throw new HttpError(502, `Address search failed (${response.status})`);

  const results = await response.json();
  res.json(
    results.map((r) => ({
      name: r.name || r.display_name.split(',')[0],
      displayName: r.display_name,
      lat: Number(r.lat),
      lng: Number(r.lon),
    }))
  );
});

module.exports = router;
