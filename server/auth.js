const crypto = require('node:crypto');
const { promisify } = require('node:util');
const db = require('./db');
const { HttpError } = require('./http-error');

const scrypt = promisify(crypto.scrypt);

const SESSION_COOKIE = 'session';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const KEY_LENGTH = 64;

// Stored as "salt:hash", both hex.
async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password, salt, KEY_LENGTH);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

async function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const expected = Buffer.from(hash, 'hex');
  const actual = await scrypt(password, Buffer.from(salt, 'hex'), KEY_LENGTH);
  return crypto.timingSafeEqual(actual, expected);
}

// Checked against when the username doesn't exist, so a login takes the same
// time either way and doesn't reveal which usernames are taken.
const dummyHash = hashPassword(crypto.randomUUID());

// The cookie holds a random token; the database only stores its SHA-256, so a
// leaked database can't be used to log in.
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function readSessionToken(req) {
  for (const part of (req.get('cookie') ?? '').split(';')) {
    const [name, ...value] = part.trim().split('=');
    if (name === SESSION_COOKIE) return decodeURIComponent(value.join('='));
  }
  return null;
}

const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: Boolean(process.env.VERCEL),
  path: '/',
};

async function startSession(res, userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const now = Date.now();
  await db.run('DELETE FROM sessions WHERE expires_at <= ?', [now]);
  await db.run('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)', [
    hashToken(token), userId, now + SESSION_TTL_MS,
  ]);
  res.cookie(SESSION_COOKIE, token, { ...cookieOptions, maxAge: SESSION_TTL_MS });
}

async function endSession(req, res) {
  const token = readSessionToken(req);
  if (token) await db.run('DELETE FROM sessions WHERE token_hash = ?', [hashToken(token)]);
  res.clearCookie(SESSION_COOKIE, cookieOptions);
}

// Returns { id, username } for the logged-in user, or null.
async function currentUser(req) {
  const token = readSessionToken(req);
  if (!token) return null;
  const user = await db.get(
    `SELECT u.id, u.username FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > ?`,
    [hashToken(token), Date.now()]
  );
  return user ?? null;
}

async function requireUser(req, res, next) {
  req.user = await currentUser(req);
  if (!req.user) throw new HttpError(401, 'Log in to continue');
  next();
}

module.exports = { hashPassword, verifyPassword, dummyHash, startSession, endSession, currentUser, requireUser };
