// routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();

const COOKIE_NAME = process.env.COOKIE_NAME || 'session';
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev_secret';
const COOKIE_MAX_AGE = Number(process.env.COOKIE_MAX_AGE || 24 * 60 * 60 * 1000);

function cookieOptions() {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'None' : 'Lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/'
  };
}

// POST /auth/signup
router.post('/signup', async (req, res) => {
  try {
    const { email, username, password, mobile } = req.body;
    if (!email || !username || !password || !mobile) return res.status(400).json({ error: 'Missing fields' });

    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ error: 'Email already in use' });

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = new User({ email, username, passwordHash, mobile });
    await user.save();

    const userSafe = { id: user._id, email: user.email, username: user.username, role: user.role, mobile: user.mobile };

    return res.status(201).json({ user: userSafe });
  } catch (err) {
    console.error('signup err', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// POST /auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Missing fields' });

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ uid: user._id, role: user.role, username: user.username }, SESSION_SECRET, { expiresIn: '24h' });
    res.cookie(COOKIE_NAME, token, cookieOptions());

    const userSafe = { id: user._id, email: user.email, username: user.username, role: user.role };
    return res.json({ user: userSafe });
  } catch (err) {
    console.error('login err', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// POST /auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME, { path: '/' });
  return res.json({ ok: true });
});

// GET /auth/me
router.get('/me', async (req, res) => {
  try {
    const token = req.cookies[COOKIE_NAME];
    if (!token) return res.json({ user: null });

    const payload = jwt.verify(token, SESSION_SECRET);
    const user = await User.findById(payload.uid).select('-passwordHash').lean();
    if (!user) {
      res.clearCookie(COOKIE_NAME, { path: '/' });
      return res.json({ user: null });
    }
    return res.json({ user });
  } catch (err) {
    console.error('me err', err);
    res.clearCookie(COOKIE_NAME, { path: '/' });
    return res.json({ user: null });
  }
});

/**
 * @openapi
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: MongoDB user _id
 *         email:
 *           type: string
 *         username:
 *           type: string
 *         role:
 *           type: string
 *         mobile:
 *           type: string
 *       required:
 *         - id
 *         - email
 *         - username
 *
 *     SignUpRequest:
 *       type: object
 *       required:
 *         - email
 *         - username
 *         - password
 *         - mobile
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *         username:
 *           type: string
 *         password:
 *           type: string
 *         mobile:
 *            type: string
 *
 *     LoginRequest:
 *       type: object
 *       required:
 *         - email
 *         - password
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *         password:
 *           type: string
 *
 * securitySchemes:
 *   cookieAuth:
 *     type: apiKey
 *     in: cookie
 *     name: session
 *
 * paths:
 *   /auth/signup:
 *     post:
 *       tags:
 *         - Auth
 *       summary: Register a new user
 *       requestBody:
 *         required: true
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SignUpRequest'
 *       responses:
 *         '201':
 *           description: Created - returns created user (safe fields)
 *           content:
 *             application/json:
 *               schema:
 *                 type: object
 *                 properties:
 *                   user:
 *                     $ref: '#/components/schemas/User'
 *         '400':
 *           description: Bad request (missing fields or email exists)
 *         '500':
 *           description: Server error
 *
 *   /auth/login:
 *     post:
 *       tags:
 *         - Auth
 *       summary: Login user (sets HttpOnly cookie)
 *       requestBody:
 *         required: true
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginRequest'
 *       responses:
 *         '200':
 *           description: Logged in, cookie set. Returns user safe info.
 *           content:
 *             application/json:
 *               schema:
 *                 type: object
 *                 properties:
 *                   user:
 *                     $ref: '#/components/schemas/User'
 *         '400':
 *           description: Missing fields
 *         '401':
 *           description: Invalid credentials
 *         '500':
 *           description: Server error
 *
 *   /auth/logout:
 *     post:
 *       tags:
 *         - Auth
 *       summary: Logout user (clears cookie)
 *       responses:
 *         '200':
 *           description: OK
 *           content:
 *             application/json:
 *               schema:
 *                 type: object
 *                 properties:
 *                   ok:
 *                     type: boolean
 *
 *   /auth/me:
 *     get:
 *       tags:
 *         - Auth
 *       summary: Get current logged in user
 *       security:
 *         - cookieAuth: []
 *       responses:
 *         '200':
 *           description: Returns current user or null
 *           content:
 *             application/json:
 *               schema:
 *                 type: object
 *                 properties:
 *                   user:
 *                     oneOf:
 *                       - $ref: '#/components/schemas/User'
 *                       - type: 'null'
 *         '401':
 *           description: Not authenticated / invalid session
 */

module.exports = router;
