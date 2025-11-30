// middleware/auth.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const COOKIE_NAME = process.env.COOKIE_NAME || 'session';
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev_secret';

/**
 * requireAuth - verifies JWT from httpOnly cookie and loads fresh user from DB
 */
async function requireAuth(req, res, next) {
  try {
    const token = req.cookies && req.cookies[COOKIE_NAME];
    if (!token) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    let payload;
    try {
      payload = jwt.verify(token, SESSION_SECRET);
    } catch (err) {
      console.warn('JWT verify failed', err?.message || err);
      res.clearCookie(COOKIE_NAME, { path: '/' });
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    if (!payload || !payload.uid) {
      res.clearCookie(COOKIE_NAME, { path: '/' });
      return res.status(401).json({ error: 'Invalid session payload' });
    }

    // load user from DB (exclude password hash)
    const user = await User.findById(payload.uid).select('-passwordHash').lean();
    if (!user) {
      res.clearCookie(COOKIE_NAME, { path: '/' });
      return res.status(401).json({ error: 'Session user not found' });
    }

    // attach user to request
    req.user = user; // includes role, email, username, _id, etc.
    return next();
  } catch (err) {
    console.error('requireAuth error', err);
    return res.status(401).json({ error: 'Authentication error' });
  }
}

/**
 * requireRole - factory to require specific role
 */
function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    if (req.user.role !== role) return res.status(403).json({ error: 'Forbidden' });
    next();
  };
}

module.exports = { requireAuth, requireRole };