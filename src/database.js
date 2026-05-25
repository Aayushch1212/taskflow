const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const DB_DIR = process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(__dirname, '../data');
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

const adapter = new FileSync(path.join(DB_DIR, 'db.json'));
const db = low(adapter);

// ── Schema defaults ────────────────────────────────────────────────────────
db.defaults({
  users: [],
  projects: [],
  project_members: [],
  tasks: [],
  comments: [],
  activity_log: [],
  _seq: { users: 1, projects: 1, tasks: 1, comments: 1, activity: 1, members: 1 }
}).write();

// ── Auto-increment helper ─────────────────────────────────────────────────
function nextId(table) {
  const id = db.get(`_seq.${table}`).value();
  db.set(`_seq.${table}`, id + 1).write();
  return id;
}

const now = () => new Date().toISOString();

// ── Simple query helpers (mimic SQLite API) ───────────────────────────────
const dbHelper = {
  // Users
  createUser(data) {
    const user = { id: nextId('users'), created_at: now(), role: 'member', avatar: null, ...data };
    db.get('users').push(user).write();
    return user;
  },
  getUserById(id) { return db.get('users').find({ id: +id }).value() || null; },
  getUserByEmail(email) { return db.get('users').find({ email: email.toLowerCase() }).value() || null; },
  getAllUsers() { return db.get('users').value(); },
  updateUser(id, data) { db.get('users').find({ id: +id }).assign(data).write(); return db.get('users').find({ id: +id }).value(); },
  deleteUser(id) { db.get('users').remove({ id: +id }).write(); db.get('project_members').remove({ user_id: +id }).write(); },
  userCount() { return db.get('users').size().value(); },

  // Projects
  createProject(data) {
    const p = { id: nextId('projects'), status: 'active', created_at: now(), updated_at: now(), description: null, ...data };
    db.get('projects').push(p).write();
    return p;
  },
  getProjectById(id) { return db.get('projects').find({ id: +id }).value() || null; },
  getAllProjects() { return db.get('projects').value(); },
  getUserProjects(userId) {
    const memberOf = db.get('project_members').filter({ user_id: +userId }).map('project_id').value();
    return db.get('projects').filter(p => memberOf.includes(p.id)).value();
  },
  updateProject(id, data) {
    db.get('projects').find({ id: +id }).assign({ ...data, updated_at: now() }).write();
    return db.get('projects').find({ id: +id }).value();
  },
  deleteProject(id) {
    db.get('projects').remove({ id: +id }).write();
    db.get('project_members').remove({ project_id: +id }).write();
    db.get('tasks').remove({ project_id: +id }).write();
    db.get('activity_log').remove({ project_id: +id }).write();
  },

  // Project members
  addMember(data) {
    const m = { id: nextId('members'), joined_at: now(), role: 'member', ...data };
    db.get('project_members').push(m).write();
    return m;
  },
  getMember(projectId, userId) { return db.get('project_members').find({ project_id: +projectId, user_id: +userId }).value() || null; },
  getProjectMembers(projectId) {
    const members = db.get('project_members').filter({ project_id: +projectId }).value();
    return members.map(m => {
      const u = dbHelper.getUserById(m.user_id);
      return u ? { ...m, name: u.name, email: u.email, avatar: u.avatar } : null;
    }).filter(Boolean).sort((a, b) => new Date(a.joined_at) - new Date(b.joined_at));
  },
  updateMemberRole(projectId, userId, role) { db.get('project_members').find({ project_id: +projectId, user_id: +userId }).assign({ role }).write(); },
  removeMember(projectId, userId) { db.get('project_members').remove({ project_id: +projectId, user_id: +userId }).write(); },

  // Tasks
  createTask(data) {
    const t = { id: nextId('tasks'), status: 'todo', priority: 'medium', created_at: now(), updated_at: now(), description: null, assignee_id: null, due_date: null, ...data };
    db.get('tasks').push(t).write();
    return t;
  },
  getTaskById(id) { return db.get('tasks').find({ id: +id }).value() || null; },
  getProjectTasks(projectId, filters = {}) {
    let tasks = db.get('tasks').filter({ project_id: +projectId }).value();
    if (filters.status) tasks = tasks.filter(t => t.status === filters.status);
    if (filters.priority) tasks = tasks.filter(t => t.priority === filters.priority);
    if (filters.assignee_id) tasks = tasks.filter(t => t.assignee_id === +filters.assignee_id);
    if (filters.search) { const s = filters.search.toLowerCase(); tasks = tasks.filter(t => t.title.toLowerCase().includes(s) || (t.description||'').toLowerCase().includes(s)); }
    return tasks.map(t => {
      const assignee = t.assignee_id ? dbHelper.getUserById(t.assignee_id) : null;
      const creator = dbHelper.getUserById(t.creator_id);
      const commentCount = db.get('comments').filter({ task_id: t.id }).size().value();
      return { ...t, assignee_name: assignee?.name || null, assignee_email: assignee?.email || null, assignee_avatar: assignee?.avatar || null, creator_name: creator?.name || null, comment_count: commentCount };
    }).sort((a, b) => {
      const pri = { urgent: 1, high: 2, medium: 3, low: 4 };
      return (pri[a.priority] - pri[b.priority]) || (a.due_date || 'z').localeCompare(b.due_date || 'z');
    });
  },
  updateTask(id, data) { db.get('tasks').find({ id: +id }).assign({ ...data, updated_at: now() }).write(); return db.get('tasks').find({ id: +id }).value(); },
  deleteTask(id) { db.get('tasks').remove({ id: +id }).write(); db.get('comments').remove({ task_id: +id }).write(); },

  // Comments
  createComment(data) {
    const c = { id: nextId('comments'), created_at: now(), ...data };
    db.get('comments').push(c).write();
    const user = dbHelper.getUserById(c.user_id);
    return { ...c, user_name: user?.name, avatar: user?.avatar };
  },
  getTaskComments(taskId) {
    return db.get('comments').filter({ task_id: +taskId }).value().map(c => {
      const u = dbHelper.getUserById(c.user_id);
      return { ...c, user_name: u?.name, avatar: u?.avatar };
    }).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  },
  getComment(id) { return db.get('comments').find({ id: +id }).value() || null; },
  deleteComment(id) { db.get('comments').remove({ id: +id }).write(); },

  // Activity
  log(userId, projectId, taskId, action, details) {
    db.get('activity_log').push({ id: nextId('activity'), user_id: userId||null, project_id: projectId||null, task_id: taskId||null, action, details: details ? JSON.stringify(details) : null, created_at: now() }).write();
  },
  getProjectActivity(projectId) {
    return db.get('activity_log').filter({ project_id: +projectId }).value().map(a => {
      const u = a.user_id ? dbHelper.getUserById(a.user_id) : null;
      const t = a.task_id ? dbHelper.getTaskById(a.task_id) : null;
      const p = dbHelper.getProjectById(a.project_id);
      return { ...a, user_name: u?.name, task_title: t?.title, project_name: p?.name };
    }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 50);
  },
  getUserActivity(userId) {
    const memberProjects = db.get('project_members').filter({ user_id: +userId }).map('project_id').value();
    return db.get('activity_log').filter(a => memberProjects.includes(a.project_id)).value().map(a => {
      const u = a.user_id ? dbHelper.getUserById(a.user_id) : null;
      const t = a.task_id ? dbHelper.getTaskById(a.task_id) : null;
      const p = a.project_id ? dbHelper.getProjectById(a.project_id) : null;
      return { ...a, user_name: u?.name, task_title: t?.title, project_name: p?.name };
    }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 20);
  },

  // Dashboard stats
  getDashboardStats(userId, isAdmin) {
    const projects = isAdmin ? dbHelper.getAllProjects() : dbHelper.getUserProjects(userId);
    const projectIds = projects.map(p => p.id);
    const allTasks = db.get('tasks').filter(t => projectIds.includes(t.project_id)).value();
    const myTasks = db.get('tasks').filter({ assignee_id: +userId }).value();
    const today = new Date().toISOString().slice(0, 10);
    return {
      total_projects: projects.length,
      active_projects: projects.filter(p => p.status === 'active').length,
      total_tasks: allTasks.length,
      my_tasks: myTasks.filter(t => t.status !== 'done').length,
      overdue_tasks: allTasks.filter(t => t.due_date && t.due_date < today && t.status !== 'done').length,
      completed_tasks: allTasks.filter(t => t.status === 'done').length,
      in_progress_tasks: allTasks.filter(t => t.status === 'in_progress').length,
    };
  },
  getMyUpcomingTasks(userId) {
    return db.get('tasks').filter(t => t.assignee_id === +userId && t.status !== 'done').value().map(t => {
      const p = dbHelper.getProjectById(t.project_id);
      return { ...t, project_name: p?.name };
    }).sort((a, b) => {
      const pri = { urgent: 1, high: 2, medium: 3, low: 4 };
      return (pri[a.priority] - pri[b.priority]);
    }).slice(0, 10);
  }
};

module.exports = dbHelper;
