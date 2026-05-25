const jwt = require('jsonwebtoken');
const db = require('./database');

const JWT_SECRET = process.env.JWT_SECRET || 'taskflow-super-secret-key-change-in-production';
const JWT_EXPIRES = '7d';

const signToken = (payload) => jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
const verifyToken = (token) => { try { return jwt.verify(token, JWT_SECRET); } catch { return null; } };

const authenticate = (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ error: 'Invalid or expired token' });
  const user = db.getUserById(payload.id);
  if (!user) return res.status(401).json({ error: 'User not found' });
  const { password: _, ...safeUser } = user;
  req.user = safeUser;
  next();
};

const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  next();
};

const requireProjectAdmin = (req, res, next) => {
  if (req.user.role === 'admin') return next();
  const projectId = req.params.projectId || req.params.id;
  const member = db.getMember(projectId, req.user.id);
  if (!member || member.role !== 'admin') return res.status(403).json({ error: 'Project admin access required' });
  next();
};

const requireProjectMember = (req, res, next) => {
  if (req.user.role === 'admin') return next();
  const projectId = req.params.projectId || req.params.id;
  const member = db.getMember(projectId, req.user.id);
  if (!member) return res.status(403).json({ error: 'Project access required' });
  next();
};

module.exports = { signToken, authenticate, requireAdmin, requireProjectAdmin, requireProjectMember };
