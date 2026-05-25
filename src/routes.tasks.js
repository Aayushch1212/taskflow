const router = require('express').Router({ mergeParams: true });
const db = require('./database');
const { authenticate, requireProjectMember } = require('./auth');

router.use(authenticate);
router.use(requireProjectMember);

const VALID_STATUS = ['todo','in_progress','review','done'];
const VALID_PRIORITY = ['low','medium','high','urgent'];

router.get('/', (req, res) => {
  const { status, priority, assignee, search } = req.query;
  const filters = {};
  if (status && VALID_STATUS.includes(status)) filters.status = status;
  if (priority && VALID_PRIORITY.includes(priority)) filters.priority = priority;
  if (assignee === 'me') filters.assignee_id = req.user.id;
  else if (assignee && !isNaN(assignee)) filters.assignee_id = +assignee;
  if (search) filters.search = search;
  res.json({ tasks: db.getProjectTasks(req.params.projectId, filters) });
});

router.post('/', (req, res) => {
  const { title, description, status, priority, assignee_id, due_date } = req.body;
  if (!title || title.trim().length < 2) return res.status(400).json({ error: 'Task title is required (min 2 chars)' });
  if (status && !VALID_STATUS.includes(status)) return res.status(400).json({ error: 'Invalid status' });
  if (priority && !VALID_PRIORITY.includes(priority)) return res.status(400).json({ error: 'Invalid priority' });
  if (assignee_id && !db.getMember(req.params.projectId, assignee_id)) return res.status(400).json({ error: 'Assignee must be a project member' });
  if (due_date && isNaN(Date.parse(due_date))) return res.status(400).json({ error: 'Invalid due date' });
  const task = db.createTask({ title: title.trim(), description: description || null, status: status || 'todo', priority: priority || 'medium', project_id: +req.params.projectId, assignee_id: assignee_id ? +assignee_id : null, creator_id: req.user.id, due_date: due_date || null });
  db.log(req.user.id, req.params.projectId, task.id, 'task_created', { title: task.title });
  const enriched = db.getProjectTasks(req.params.projectId).find(t => t.id === task.id);
  res.status(201).json({ task: enriched || task });
});

router.get('/:id', (req, res) => {
  const task = db.getTaskById(req.params.id);
  if (!task || task.project_id !== +req.params.projectId) return res.status(404).json({ error: 'Task not found' });
  const comments = db.getTaskComments(req.params.id);
  const assignee = task.assignee_id ? db.getUserById(task.assignee_id) : null;
  const creator = db.getUserById(task.creator_id);
  res.json({ task: { ...task, assignee_name: assignee?.name, creator_name: creator?.name }, comments });
});

router.put('/:id', (req, res) => {
  const task = db.getTaskById(req.params.id);
  if (!task || task.project_id !== +req.params.projectId) return res.status(404).json({ error: 'Task not found' });
  const member = db.getMember(req.params.projectId, req.user.id);
  const canEdit = req.user.role === 'admin' || (member && member.role === 'admin') || task.creator_id === req.user.id || task.assignee_id === req.user.id;
  if (!canEdit) return res.status(403).json({ error: 'You can only edit tasks you created or are assigned to' });
  const { title, description, status, priority, assignee_id, due_date } = req.body;
  const updates = {};
  if (title) updates.title = title.trim();
  if (description !== undefined) updates.description = description;
  if (status) { if (!VALID_STATUS.includes(status)) return res.status(400).json({ error: 'Invalid status' }); updates.status = status; }
  if (priority) { if (!VALID_PRIORITY.includes(priority)) return res.status(400).json({ error: 'Invalid priority' }); updates.priority = priority; }
  if (assignee_id !== undefined) updates.assignee_id = assignee_id ? +assignee_id : null;
  if (due_date !== undefined) updates.due_date = due_date || null;
  const updated = db.updateTask(req.params.id, updates);
  if (status && status !== task.status) db.log(req.user.id, req.params.projectId, task.id, 'task_status_changed', { from: task.status, to: status });
  else db.log(req.user.id, req.params.projectId, task.id, 'task_updated', { title: updated.title });
  const enriched = db.getProjectTasks(req.params.projectId).find(t => t.id === updated.id);
  res.json({ task: enriched || updated });
});

router.delete('/:id', (req, res) => {
  const task = db.getTaskById(req.params.id);
  if (!task || task.project_id !== +req.params.projectId) return res.status(404).json({ error: 'Task not found' });
  const member = db.getMember(req.params.projectId, req.user.id);
  const canDelete = req.user.role === 'admin' || (member && member.role === 'admin') || task.creator_id === req.user.id;
  if (!canDelete) return res.status(403).json({ error: 'Insufficient permissions' });
  db.deleteTask(req.params.id);
  db.log(req.user.id, req.params.projectId, null, 'task_deleted', { title: task.title });
  res.json({ message: 'Task deleted' });
});

router.post('/:id/comments', (req, res) => {
  const { content } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ error: 'Comment cannot be empty' });
  const task = db.getTaskById(req.params.id);
  if (!task || task.project_id !== +req.params.projectId) return res.status(404).json({ error: 'Task not found' });
  const comment = db.createComment({ task_id: +req.params.id, user_id: req.user.id, content: content.trim() });
  db.log(req.user.id, req.params.projectId, req.params.id, 'comment_added', {});
  res.status(201).json({ comment });
});

router.delete('/:id/comments/:commentId', (req, res) => {
  const comment = db.getComment(req.params.commentId);
  if (!comment || comment.task_id !== +req.params.id) return res.status(404).json({ error: 'Comment not found' });
  if (comment.user_id !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'You can only delete your own comments' });
  db.deleteComment(req.params.commentId);
  res.json({ message: 'Comment deleted' });
});

module.exports = router;
