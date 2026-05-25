const router = require('express').Router();
const db = require('./database');
const { authenticate, requireProjectAdmin, requireProjectMember } = require('./auth');

router.use(authenticate);

const enrichProject = (p, userId, isAdmin) => {
  const members = db.getProjectMembers(p.id);
  const tasks = db.getProjectTasks(p.id);
  const myMember = members.find(m => m.user_id === +userId);
  const owner = db.getUserById(p.owner_id);
  return {
    ...p,
    owner_name: owner?.name,
    member_count: members.length,
    task_count: tasks.length,
    done_count: tasks.filter(t => t.status === 'done').length,
    my_role: myMember?.role || (isAdmin ? 'admin' : null),
  };
};

router.get('/', (req, res) => {
  const isAdmin = req.user.role === 'admin';
  const projects = isAdmin ? db.getAllProjects() : db.getUserProjects(req.user.id);
  res.json({ projects: projects.map(p => enrichProject(p, req.user.id, isAdmin)).sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)) });
});

router.post('/', (req, res) => {
  const { name, description } = req.body;
  if (!name || name.trim().length < 2) return res.status(400).json({ error: 'Project name is required (min 2 chars)' });
  const project = db.createProject({ name: name.trim(), description: description || null, owner_id: req.user.id });
  db.addMember({ project_id: project.id, user_id: req.user.id, role: 'admin' });
  db.log(req.user.id, project.id, null, 'project_created', { name: project.name });
  res.status(201).json({ project });
});

router.get('/:id', requireProjectMember, (req, res) => {
  const project = db.getProjectById(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  const members = db.getProjectMembers(req.params.id);
  const owner = db.getUserById(project.owner_id);
  res.json({ project: { ...project, owner_name: owner?.name, member_count: members.length }, members });
});

router.put('/:id', requireProjectAdmin, (req, res) => {
  const project = db.getProjectById(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  const { name, description, status } = req.body;
  const updates = {};
  if (name) updates.name = name.trim();
  if (description !== undefined) updates.description = description;
  if (status) {
    if (!['active','archived','completed'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
    updates.status = status;
  }
  const updated = db.updateProject(req.params.id, updates);
  db.log(req.user.id, project.id, null, 'project_updated', { name: updated.name });
  res.json({ project: updated });
});

router.delete('/:id', requireProjectAdmin, (req, res) => {
  const project = db.getProjectById(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  if (project.owner_id !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Only the owner can delete this project' });
  db.deleteProject(req.params.id);
  res.json({ message: 'Project deleted' });
});

router.post('/:id/members', requireProjectAdmin, (req, res) => {
  const { email, role } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });
  const user = db.getUserByEmail(email.toLowerCase());
  if (!user) return res.status(404).json({ error: 'User not found. They must register first.' });
  if (db.getMember(req.params.id, user.id)) return res.status(409).json({ error: 'User is already a member' });
  const memberRole = ['admin','member'].includes(role) ? role : 'member';
  db.addMember({ project_id: +req.params.id, user_id: user.id, role: memberRole });
  db.log(req.user.id, req.params.id, null, 'member_added', { userId: user.id, name: user.name });
  res.status(201).json({ message: 'Member added', user: { id: user.id, name: user.name, email: user.email, role: memberRole } });
});

router.put('/:id/members/:userId', requireProjectAdmin, (req, res) => {
  const { role } = req.body;
  if (!['admin','member'].includes(role)) return res.status(400).json({ error: 'Role must be admin or member' });
  if (!db.getMember(req.params.id, req.params.userId)) return res.status(404).json({ error: 'Member not found' });
  db.updateMemberRole(req.params.id, req.params.userId, role);
  res.json({ message: 'Role updated' });
});

router.delete('/:id/members/:userId', requireProjectAdmin, (req, res) => {
  const project = db.getProjectById(req.params.id);
  if (project.owner_id == req.params.userId) return res.status(400).json({ error: 'Cannot remove the project owner' });
  db.removeMember(req.params.id, req.params.userId);
  res.json({ message: 'Member removed' });
});

router.get('/:id/activity', requireProjectMember, (req, res) => {
  res.json({ activity: db.getProjectActivity(req.params.id) });
});

module.exports = router;
