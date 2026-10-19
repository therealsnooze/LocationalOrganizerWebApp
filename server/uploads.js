const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { Readable } = require('node:stream');
const multer = require('multer');
const { put, get, del } = require('@vercel/blob');
const { UPLOAD_DIR, MAX_FILE_SIZE, ALLOWED_TYPES } = require('./config');
const { HttpError } = require('./http-error');

// Vercel Blob when a store is connected, the local uploads/ folder otherwise.
const USE_BLOB = Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
  defParamCharset: 'utf8',
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!Object.hasOwn(ALLOWED_TYPES, ext)) {
      const allowed = Object.keys(ALLOWED_TYPES).join(', ');
      return cb(new HttpError(400, `File type not allowed. Allowed: ${allowed}`));
    }
    cb(null, true);
  },
});

// Returns the name to record in the database. Never derived from the client's filename.
async function saveFile(buffer, mimeType) {
  const name = crypto.randomUUID();
  if (USE_BLOB) {
    const blob = await put(`uploads/${name}`, buffer, { access: 'private', contentType: mimeType });
    return blob.pathname;
  }
  await fs.promises.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.promises.writeFile(path.join(UPLOAD_DIR, name), buffer);
  return name;
}

// Returns a readable stream of the file's contents, or null if it's missing.
async function openFile(storedName) {
  if (USE_BLOB) {
    const result = await get(storedName, { access: 'private' });
    return result?.stream ? Readable.fromWeb(result.stream) : null;
  }
  try {
    const handle = await fs.promises.open(path.join(UPLOAD_DIR, storedName));
    return handle.createReadStream();
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

// Best-effort removal; a missing file shouldn't block deleting its record.
async function removeFile(storedName) {
  try {
    if (USE_BLOB) await del(storedName);
    else await fs.promises.rm(path.join(UPLOAD_DIR, storedName), { force: true });
  } catch (err) {
    console.error(`Failed to delete upload ${storedName}:`, err);
  }
}

function mimeTypeFor(originalName) {
  return ALLOWED_TYPES[path.extname(originalName).toLowerCase()];
}

module.exports = { upload, saveFile, openFile, removeFile, mimeTypeFor };
