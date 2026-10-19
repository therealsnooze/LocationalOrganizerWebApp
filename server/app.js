const express = require('express');
const multer = require('multer');
const { PUBLIC_DIR, MAX_FILE_SIZE } = require('./config');
const { HttpError } = require('./http-error');

const app = express();

app.use(express.json({ limit: '100kb' }));
// Only used locally; on Vercel, public/ is served by the CDN.
app.use(express.static(PUBLIC_DIR));

app.use('/api/locations', require('./routes/locations'));
app.use('/api/files', require('./routes/files'));
app.use('/api/geocode', require('./routes/geocode'));

app.use('/api', (req, res, next) => next(new HttpError(404, 'Not found')));

app.use((err, req, res, next) => {
  // Failed partway through streaming a download; let Express close the connection.
  if (res.headersSent) return next(err);

  let status = err.status || err.statusCode || 500;
  let message = err.expose || err instanceof HttpError ? err.message : 'Internal server error';

  if (err instanceof multer.MulterError) {
    status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    message = err.code === 'LIMIT_FILE_SIZE'
      ? `File is too large (max ${MAX_FILE_SIZE / 1024 / 1024} MB)`
      : err.message;
  }
  if (status >= 500) console.error(err);

  res.status(status).json({ error: message });
});

module.exports = app;
