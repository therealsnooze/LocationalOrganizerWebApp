const express = require('express');
const db = require('../db');
const { HttpError, parseId } = require('../http-error');
const { storedPath, removeStoredFile } = require('../uploads');

const router = express.Router();

const selectFile = db.prepare('SELECT * FROM files WHERE id = ?');
const deleteFile = db.prepare('DELETE FROM files WHERE id = ?');

function getFileOr404(id) {
  const file = selectFile.get(id);
  if (!file) throw new HttpError(404, 'File not found');
  return file;
}

router.get('/:id', (req, res, next) => {
  const file = getFileOr404(parseId(req.params.id));
  // Always an attachment with a fixed type, so the browser never renders uploads inline.
  res.set('X-Content-Type-Options', 'nosniff');
  res.download(
    storedPath(file.stored_name),
    file.original_name,
    { headers: { 'Content-Type': file.mime_type } },
    (err) => {
      if (err && !res.headersSent) next(err.code === 'ENOENT' ? new HttpError(404, 'File missing on disk') : err);
    }
  );
});

router.delete('/:id', (req, res) => {
  const file = getFileOr404(parseId(req.params.id));
  deleteFile.run(file.id);
  removeStoredFile(file.stored_name);
  res.status(204).end();
});

module.exports = router;
