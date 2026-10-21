const express = require('express');
const db = require('../db');
const { HttpError } = require('../http-error');
const {
  hashPassword, verifyPassword, dummyHash, startSession, endSession, currentUser,
} = require('../auth');

const router = express.Router();

const USERNAME_PATTERN = /^[A-Za-z0-9_.-]{3,30}$/;
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 200; // scrypt cost grows with input; don't hash megabytes

function readCredentials(body) {
  const username = typeof body.username === 'string' ? body.username.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!username || !password) throw new HttpError(400, 'Username and password are required');
  if (password.length > PASSWORD_MAX) throw new HttpError(400, `Password must be at most ${PASSWORD_MAX} characters`);
  return { username, password };
}

router.post('/register', async (req, res) => {
  const { username, password } = readCredentials(req.body ?? {});
  if (!USERNAME_PATTERN.test(username)) {
    throw new HttpError(400, 'Username must be 3–30 letters, numbers, dots, dashes or underscores');
  }
  if (password.length < PASSWORD_MIN) {
    throw new HttpError(400, `Password must be at least ${PASSWORD_MIN} characters`);
  }
  if (await db.get('SELECT 1 FROM users WHERE username = ?', [username])) {
    throw new HttpError(409, 'That username is taken');
  }

  const { lastInsertRowid: userId } = await db.run(
    'INSERT INTO users (username, password_hash) VALUES (?, ?)',
    [username, await hashPassword(password)]
  );
  // Places saved before accounts existed go to the first account.
  const { n } = await db.get('SELECT COUNT(*) AS n FROM users');
  if (n === 1) await db.run('UPDATE locations SET user_id = ? WHERE user_id IS NULL', [userId]);

  await startSession(res, userId);
  res.status(201).json({ user: await db.get('SELECT id, username FROM users WHERE id = ?', [userId]) });
});

router.post('/login', async (req, res) => {
  const { username, password } = readCredentials(req.body ?? {});
  const user = await db.get('SELECT id, username, password_hash FROM users WHERE username = ?', [username]);
  const ok = await verifyPassword(password, user?.password_hash ?? await dummyHash);
  if (!user || !ok) throw new HttpError(401, 'Wrong username or password');

  await startSession(res, user.id);
  res.json({ user: { id: user.id, username: user.username } });
});

router.post('/logout', async (req, res) => {
  await endSession(req, res);
  res.status(204).end();
});

router.get('/me', async (req, res) => {
  res.json({ user: await currentUser(req) });
});

module.exports = router;
