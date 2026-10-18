const express = require('express');
const db = require('../db');
const { BOUNDS } = require('../config');
const { HttpError, parseId } = require('../http-error');
const { upload, removeStoredFile, mimeTypeFor } = require('../uploads');

const router = express.Router();

const NAME_MAX = 100;
const DESCRIPTION_MAX = 2000;

const selectLocation = db.prepare(`
  SELECT l.*, COUNT(f.id) AS file_count
  FROM locations l LEFT JOIN files f ON f.location_id = l.id
  WHERE l.id = ?
  GROUP BY l.id
`);
const selectAllLocations = db.prepare(`
  SELECT l.*, COUNT(f.id) AS file_count
  FROM locations l LEFT JOIN files f ON f.location_id = l.id
  GROUP BY l.id
  ORDER BY l.created_at DESC, l.id DESC
`);
const insertLocation = db.prepare(
  'INSERT INTO locations (name, description, lat, lng) VALUES (?, ?, ?, ?)'
);
const updateLocation = db.prepare(
  'UPDATE locations SET name = ?, description = ? WHERE id = ?'
);
const deleteLocation = db.prepare('DELETE FROM locations WHERE id = ?');
const selectFilesForLocation = db.prepare(
  'SELECT id, location_id, original_name, mime_type, size, uploaded_at FROM files WHERE location_id = ? ORDER BY uploaded_at DESC, id DESC'
);
const selectStoredNames = db.prepare('SELECT stored_name FROM files WHERE location_id = ?');
const insertFile = db.prepare(`
  INSERT INTO files (location_id, original_name, stored_name, mime_type, size)
  VALUES (?, ?, ?, ?, ?)
`);
const selectFile = db.prepare(
  'SELECT id, location_id, original_name, mime_type, size, uploaded_at FROM files WHERE id = ?'
);

function getLocationOr404(id) {
  const location = selectLocation.get(id);
  if (!location) throw new HttpError(404, 'Location not found');
  return location;
}

function validateText(body) {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  if (!name) throw new HttpError(400, 'Name is required');
  if (name.length > NAME_MAX) throw new HttpError(400, `Name must be at most ${NAME_MAX} characters`);
  if (description.length > DESCRIPTION_MAX) {
    throw new HttpError(400, `Description must be at most ${DESCRIPTION_MAX} characters`);
  }
  return { name, description };
}

function validateCoords(body) {
  const lat = Number(body.lat);
  const lng = Number(body.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new HttpError(400, 'lat and lng must be numbers');
  }
  if (lat < BOUNDS.south || lat > BOUNDS.north || lng < BOUNDS.west || lng > BOUNDS.east) {
    throw new HttpError(400, 'Location must be inside LA County');
  }
  return { lat, lng };
}

router.get('/', (req, res) => {
  res.json(selectAllLocations.all());
});

router.post('/', (req, res) => {
  const { name, description } = validateText(req.body ?? {});
  const { lat, lng } = validateCoords(req.body ?? {});
  const { lastInsertRowid } = insertLocation.run(name, description, lat, lng);
  res.status(201).json(getLocationOr404(lastInsertRowid));
});

router.put('/:id', (req, res) => {
  const id = parseId(req.params.id);
  getLocationOr404(id);
  const { name, description } = validateText(req.body ?? {});
  updateLocation.run(name, description, id);
  res.json(getLocationOr404(id));
});

router.delete('/:id', (req, res) => {
  const id = parseId(req.params.id);
  getLocationOr404(id);
  const storedNames = selectStoredNames.all(id).map((row) => row.stored_name);
  deleteLocation.run(id); // file rows go with it via ON DELETE CASCADE
  storedNames.forEach(removeStoredFile);
  res.status(204).end();
});

router.get('/:id/files', (req, res) => {
  const id = parseId(req.params.id);
  getLocationOr404(id);
  res.json(selectFilesForLocation.all(id));
});

router.post(
  '/:id/files',
  // Check the location before multer writes anything to disk.
  (req, res, next) => {
    req.locationId = parseId(req.params.id);
    getLocationOr404(req.locationId);
    next();
  },
  upload.single('file'),
  (req, res) => {
    if (!req.file) throw new HttpError(400, 'No file uploaded (expected form field "file")');
    const { originalname, filename, size } = req.file;
    let fileId;
    try {
      fileId = insertFile.run(req.locationId, originalname, filename, mimeTypeFor(originalname), size)
        .lastInsertRowid;
    } catch (err) {
      removeStoredFile(filename);
      throw err;
    }
    res.status(201).json(selectFile.get(fileId));
  }
);

module.exports = router;
