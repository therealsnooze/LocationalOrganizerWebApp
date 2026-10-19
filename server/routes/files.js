const { pipeline } = require('node:stream/promises');
const express = require('express');
const db = require('../db');
const { HttpError, parseId } = require('../http-error');
const { openFile, removeFile } = require('../uploads');

const router = express.Router();

async function getFileOr404(id) {
  const file = await db.get('SELECT * FROM files WHERE id = ?', [id]);
  if (!file) throw new HttpError(404, 'File not found');
  return file;
}

router.get('/:id', async (req, res) => {
  const file = await getFileOr404(parseId(req.params.id));
  const stream = await openFile(file.stored_name);
  if (!stream) throw new HttpError(404, 'File missing from storage');
  // Always an attachment with a fixed type, so the browser never renders uploads inline.
  res.attachment(file.original_name);
  res.set({ 'Content-Type': file.mime_type, 'X-Content-Type-Options': 'nosniff' });
  await pipeline(stream, res);
});

router.delete('/:id', async (req, res) => {
  const file = await getFileOr404(parseId(req.params.id));
  await db.run('DELETE FROM files WHERE id = ?', [file.id]);
  await removeFile(file.stored_name);
  res.status(204).end();
});

module.exports = router;
