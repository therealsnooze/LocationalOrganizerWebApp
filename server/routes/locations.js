const express = require('express');
const db = require('../db');
const { HttpError, parseId } = require('../http-error');
const { upload, saveFile, removeFile, mimeTypeFor } = require('../uploads');

const router = express.Router();

const NAME_MAX = 100;
const DESCRIPTION_MAX = 2000;

const SELECT_LOCATIONS = `
  SELECT l.*, COUNT(f.id) AS file_count
  FROM locations l LEFT JOIN files f ON f.location_id = l.id
`;
const FILE_COLUMNS = 'id, location_id, original_name, mime_type, size, uploaded_at';

// Someone else's place is reported as not found, same as a missing one.
async function getLocationOr404(id, userId) {
  const location = await db.get(
    `${SELECT_LOCATIONS} WHERE l.id = ? AND l.user_id = ? GROUP BY l.id`,
    [id, userId]
  );
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
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw new HttpError(400, 'lat must be between -90 and 90, lng between -180 and 180');
  }
  return { lat, lng };
}

router.get('/', async (req, res) => {
  res.json(await db.all(
    `${SELECT_LOCATIONS} WHERE l.user_id = ? GROUP BY l.id ORDER BY l.created_at DESC, l.id DESC`,
    [req.user.id]
  ));
});

router.post('/', async (req, res) => {
  const { name, description } = validateText(req.body ?? {});
  const { lat, lng } = validateCoords(req.body ?? {});
  const { lastInsertRowid } = await db.run(
    'INSERT INTO locations (user_id, name, description, lat, lng) VALUES (?, ?, ?, ?, ?)',
    [req.user.id, name, description, lat, lng]
  );
  res.status(201).json(await getLocationOr404(lastInsertRowid, req.user.id));
});

router.put('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  await getLocationOr404(id, req.user.id);
  const { name, description } = validateText(req.body ?? {});
  await db.run('UPDATE locations SET name = ?, description = ? WHERE id = ?', [name, description, id]);
  res.json(await getLocationOr404(id, req.user.id));
});

router.delete('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  await getLocationOr404(id, req.user.id);
  const storedNames = (await db.all('SELECT stored_name FROM files WHERE location_id = ?', [id]))
    .map((row) => row.stored_name);
  await db.batch([
    { sql: 'DELETE FROM files WHERE location_id = ?', args: [id] },
    { sql: 'DELETE FROM locations WHERE id = ?', args: [id] },
  ]);
  await Promise.all(storedNames.map(removeFile));
  res.status(204).end();
});

router.get('/:id/files', async (req, res) => {
  const id = parseId(req.params.id);
  await getLocationOr404(id, req.user.id);
  res.json(await db.all(
    `SELECT ${FILE_COLUMNS} FROM files WHERE location_id = ? ORDER BY uploaded_at DESC, id DESC`,
    [id]
  ));
});

router.post(
  '/:id/files',
  // Check the location before accepting the upload.
  async (req, res, next) => {
    req.locationId = parseId(req.params.id);
    await getLocationOr404(req.locationId, req.user.id);
    next();
  },
  upload.single('file'),
  async (req, res) => {
    if (!req.file) throw new HttpError(400, 'No file uploaded (expected form field "file")');
    const { originalname, buffer, size } = req.file;
    const mimeType = mimeTypeFor(originalname);
    const storedName = await saveFile(buffer, mimeType);
    let fileId;
    try {
      ({ lastInsertRowid: fileId } = await db.run(
        'INSERT INTO files (location_id, original_name, stored_name, mime_type, size) VALUES (?, ?, ?, ?, ?)',
        [req.locationId, originalname, storedName, mimeType, size]
      ));
    } catch (err) {
      await removeFile(storedName);
      throw err;
    }
    res.status(201).json(await db.get(`SELECT ${FILE_COLUMNS} FROM files WHERE id = ?`, [fileId]));
  }
);

module.exports = router;
