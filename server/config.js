const path = require('node:path');

const ROOT = path.join(__dirname, '..');

module.exports = {
  PORT: Number(process.env.PORT) || 3000,
  DATA_DIR: path.join(ROOT, 'data'),
  UPLOAD_DIR: path.join(ROOT, 'uploads'),
  PUBLIC_DIR: path.join(ROOT, 'public'),
  LEAFLET_DIR: path.join(ROOT, 'node_modules', 'leaflet', 'dist'),

  // Rough LA County box, including Catalina and San Clemente islands.
  BOUNDS: { south: 32.75, west: -119.0, north: 34.85, east: -117.6 },

  MAX_FILE_SIZE: 10 * 1024 * 1024,

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
