const express = require('express');
const multer = require('multer');
const { PORT, PUBLIC_DIR, LEAFLET_DIR } = require('./config');
const { HttpError } = require('./http-error');

const app = express();

app.use(express.json({ limit: '100kb' }));
app.use(express.static(PUBLIC_DIR));
app.use('/vendor/leaflet', express.static(LEAFLET_DIR));

app.use('/api/locations', require('./routes/locations'));
app.use('/api/files', require('./routes/files'));
app.use('/api/geocode', require('./routes/geocode'));

app.use('/api', (req, res, next) => next(new HttpError(404, 'Not found')));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  let status = err.status || err.statusCode || 500;
  let message = err.expose || err instanceof HttpError ? err.message : 'Internal server error';

  if (err instanceof multer.MulterError) {
    status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    message = err.code === 'LIMIT_FILE_SIZE' ? 'File is too large (max 10 MB)' : err.message;
  }
  if (status >= 500) console.error(err);

  res.status(status).json({ error: message });
});

app.listen(PORT, () => {
  console.log(`Locational Organizer running at http://localhost:${PORT}`);
});
