// routes/users.js
const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

/**
 * POST /users
 * Admin-only: create user with role
 */
router.post('/', requireRole('admin'), async (req, res) => {
  try {
    const { email, username, password, role, mobile } = req.body;
    if (!email || !username || !password) return res.status(400).json({ error: 'Missing fields' });

    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ error: 'Email already exists' });

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = new User({ email, username, passwordHash, role: role || 'user', mobile });
    await user.save();

    const userSafe = { id: user._id, email: user.email, username: user.username, role: user.role, mobile: user.mobile };
    return res.status(201).json({ user: userSafe });
  } catch (err) {
    console.error('create user err', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

/**
 * GET /users
 * Admin-only: list users (customers)
 * Query params:
 *   - page (1-based)
 *   - limit
 *   - q (search by email or username)
 */
router.get('/', requireRole('admin'), async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Number(req.query.limit || 20));
    const q = (req.query.q || '').trim();

    const filter = {};
    if (q) {
      // case-insensitive partial match on email or username or mobile
      const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ email: re }, { username: re }, { mobile: re }];
    }

    const total = await User.countDocuments(filter);
    const users = await User.find(filter)
      .select('-passwordHash')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    return res.json({
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
      users: users.map(u => ({ id: u._id, email: u.email, username: u.username, mobile: u.mobile, role: u.role, createdAt: u.createdAt }))
    });
  } catch (err) {
    console.error('list users err', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

/**
 * GET /users/:id
 * Admin-only: get single user
 */
router.get('/:id', requireRole('admin'), async (req, res) => {
  try {
    const u = await User.findById(req.params.id).select('-passwordHash').lean();
    if (!u) return res.status(404).json({ error: 'Not found' });
    return res.json({ user: { id: u._id, email: u.email, username: u.username, mobile: u.mobile, role: u.role, createdAt: u.createdAt } });
  } catch (err) {
    console.error('get user err', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

/**
 * PUT /users/:id
 * Admin-only: update user fields (email, username, mobile, role, optional password)
 */
router.put('/:id', requireRole('admin'), async (req, res) => {
  try {
    const { email, username, mobile, role, password } = req.body;
    const update = {};

    if (email) update.email = email;
    if (username) update.username = username;
    if (mobile) update.mobile = mobile;
    if (role) update.role = role;

    if (password) {
      const salt = await bcrypt.genSalt(10);
      update.passwordHash = await bcrypt.hash(password, salt);
    }

    const updated = await User.findByIdAndUpdate(req.params.id, update, { new: true }).select('-passwordHash').lean();
    if (!updated) return res.status(404).json({ error: 'Not found' });

    return res.json({ user: { id: updated._id, email: updated.email, username: updated.username, mobile: updated.mobile, role: updated.role, createdAt: updated.createdAt } });
  } catch (err) {
    console.error('update user err', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

/**
 * DELETE /users/:id
 * Admin-only: remove a user
 */
router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    const removed = await User.findByIdAndDelete(req.params.id).lean();
    if (!removed) return res.status(404).json({ error: 'Not found' });
    return res.json({ ok: true });
  } catch (err) {
    console.error('delete user err', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
