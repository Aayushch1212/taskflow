const router = require('express').Router();
const db = require('./database');
const { authenticate, requireAdmin } = require('./auth');

router.use(authenticate);

router.get('/dashboard', (req, res) => {
  const isAdmin = req.user.role === 'admin';
  const stats = db.getDashboardStats(req.user.id, isAdmin);
  const myTasks = db.getMyUpcomingTasks(req.user.id);
  const recentActivity = db.getUserActivity(req.user.id);
  res.json({ stats, myTasks, overdueTasks: [], recentActivity, tasksByStatus: [] });
});

router.get('/users', requireAdmin, (req, res) => {
  const users = db.getAllUsers().map(u => { const { password: _, ...s } = u; return s; })
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  res.json({ users });
});

router.put('/users/:id/role', requireAdmin, (req, res) => {
  const { role } = req.body;
  if (!['admin','member'].includes(role)) return res.status(400).json({ error: 'Role must be admin or member' });
  const user = db.getUserById(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.id === req.user.id) return res.status(400).json({ error: 'Cannot change your own role' });
  db.updateUser(req.params.id, { role });
  res.json({ message: 'Role updated' });
});

router.delete('/users/:id', requireAdmin, (req, res) => {
  if (+req.params.id === req.user.id) return res.status(400).json({ error: 'Cannot delete yourself' });
  if (!db.getUserById(req.params.id)) return res.status(404).json({ error: 'User not found' });
  db.deleteUser(req.params.id);
  res.json({ message: 'User deleted' });
});

router.get('/users/search', (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 2) return res.json({ users: [] });
  const lq = q.toLowerCase();
  const users = db.getAllUsers().filter(u => u.name.toLowerCase().includes(lq) || u.email.toLowerCase().includes(lq))
    .slice(0, 10).map(u => ({ id: u.id, name: u.name, email: u.email, avatar: u.avatar }));
  res.json({ users });
});

module.exports = router;
