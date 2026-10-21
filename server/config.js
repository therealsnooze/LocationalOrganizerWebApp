const path = require('node:path');

const ROOT = path.join(__dirname, '..');

module.exports = {
  PORT: Number(process.env.PORT) || 3000,
  DATA_DIR: path.join(ROOT, 'data'),
  UPLOAD_DIR: path.join(ROOT, 'uploads'),
  PUBLIC_DIR: path.join(ROOT, 'public'),

  // Vercel rejects request bodies over 4.5 MB, so stay under that.
  MAX_FILE_SIZE: 4 * 1024 * 1024,

  // Allowed upload extensions and the MIME type we record for each. Browsers report
  // MIME types inconsistently (CSV as application/vnd.ms-excel, unknowns as
  // application/octet-stream), so the extension is what decides.
  ALLOWED_TYPES: {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.pdf': 'application/pdf',
    '.txt': 'text/plain',
    '.csv': 'text/csv',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  },
};
