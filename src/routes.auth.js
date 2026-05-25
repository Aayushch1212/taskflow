const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db = require('./database');
const { signToken, authenticate } = require('./auth');

router.post('/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password are required' });
    if (name.trim().length < 2) return res.status(400).json({ error: 'Name must be at least 2 characters' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Invalid email format' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
    if (db.getUserByEmail(email)) return res.status(409).json({ error: 'Email already registered' });
    const hash = await bcrypt.hash(password, 10);
    const role = db.userCount() === 0 ? 'admin' : 'member';
    const user = db.createUser({ name: name.trim(), email: email.toLowerCase(), password: hash, role });
    const { password: _, ...safeUser } = user;
    const token = signToken({ id: user.id, email: user.email, role: user.role });
    res.status(201).json({ token, user: safeUser });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
    const user = db.getUserByEmail(email.toLowerCase());
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    const { password: _, ...safeUser } = user;
    const token = signToken({ id: user.id, email: user.email, role: user.role });
    res.json({ token, user: safeUser });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

router.get('/me', authenticate, (req, res) => res.json({ user: req.user }));

router.put('/profile', authenticate, async (req, res) => {
  try {
    const { name, avatar, currentPassword, newPassword } = req.body;
    const updates = {};
    if (name) {
      if (name.trim().length < 2) return res.status(400).json({ error: 'Name too short' });
      updates.name = name.trim();
    }
    if (avatar !== undefined) updates.avatar = avatar;
    if (newPassword) {
      if (!currentPassword) return res.status(400).json({ error: 'Current password required' });
      const user = db.getUserById(req.user.id);
      const valid = await bcrypt.compare(currentPassword, user.password);
      if (!valid) return res.status(401).json({ error: 'Current password incorrect' });
      if (newPassword.length < 6) return res.status(400).json({ error: 'New password too short' });
      updates.password = await bcrypt.hash(newPassword, 10);
    }
    if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'Nothing to update' });
    const updated = db.updateUser(req.user.id, updates);
    const { password: _, ...safeUser } = updated;
    res.json({ user: safeUser });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;
