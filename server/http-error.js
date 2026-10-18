class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Parses a route :id param, throwing 404 for anything that isn't a positive integer.
function parseId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) throw new HttpError(404, 'Not found');
  return id;
}

module.exports = { HttpError, parseId };
