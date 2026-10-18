const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const multer = require('multer');
const { UPLOAD_DIR, MAX_FILE_SIZE, ALLOWED_TYPES } = require('./config');
const { HttpError } = require('./http-error');

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    // Never derive the on-disk name from the client's filename.
    filename: (req, file, cb) => cb(null, crypto.randomUUID()),
  }),
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

function storedPath(storedName) {
  return path.join(UPLOAD_DIR, storedName);
}

// Best-effort removal; a missing file shouldn't block deleting its record.
function removeStoredFile(storedName) {
  fs.rm(storedPath(storedName), { force: true }, (err) => {
    if (err) console.error(`Failed to delete upload ${storedName}:`, err);
  });
}

function mimeTypeFor(originalName) {
  return ALLOWED_TYPES[path.extname(originalName).toLowerCase()];
}

module.exports = { upload, storedPath, removeStoredFile, mimeTypeFor };
