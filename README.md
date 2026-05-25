# TaskFlow — Team Task Manager

A full-stack Team Task Manager with role-based access control, built with Node.js + Express + lowdb (JSON database).

## 🚀 Live Demo
> Deploy to Railway and add URL here

---

## ✨ Features

### Authentication
- Signup / Login with JWT tokens (7-day expiry)
- First registered user is automatically **Admin**
- Password hashing with bcrypt
- Profile management (name, password change)

### Role-Based Access Control
| Feature | Admin | Project Admin | Member |
|---|---|---|---|
| Manage all users | ✅ | ❌ | ❌ |
| Create projects | ✅ | ✅ | ✅ |
| Delete any project | ✅ | Owner only | ❌ |
| Add/remove members | ✅ | ✅ | ❌ |
| Create tasks | ✅ | ✅ | ✅ |
| Edit any task | ✅ | ✅ | Own/assigned only |
| Delete tasks | ✅ | ✅ | Creator only |

### Projects
- Create, edit, archive, delete projects
- Project status: Active / Completed / Archived
- Progress tracking (% done)
- Member management with per-project roles (admin/member)
- Activity log per project

### Tasks
- Kanban board view (To Do / In Progress / Review / Done)
- List view with sorting
- Priority levels: Low / Medium / High / Urgent
- Assignee, due date, description
- Comments on tasks
- Overdue detection and highlighting
- Filters: status, priority, assignee, full-text search

### Dashboard
- Stats: total projects, tasks, my tasks, overdue, completed, in-progress
- My upcoming tasks (sorted by priority)
- Recent activity feed
- Cross-project visibility

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 18+ |
| Framework | Express.js |
| Database | lowdb (JSON file, zero native deps) |
| Auth | JWT (jsonwebtoken) + bcryptjs |
| Frontend | Vanilla JS SPA (no build step) |
| Deployment | Railway |

---

## 📦 Local Setup

```bash
# 1. Clone the repo
git clone <your-repo-url>
cd taskflow

# 2. Install dependencies
npm install

# 3. Start the server
npm start
# → http://localhost:3000
```

No `.env` needed for local dev. For production, set:
```
JWT_SECRET=your-super-secret-key-here
PORT=3000
RAILWAY_VOLUME_MOUNT_PATH=/data   # Railway sets this automatically
```

---

## 🚂 Deploy to Railway

### Option A: GitHub (recommended)
1. Push code to a GitHub repo
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Select the repo
4. Add a **Volume**: click on the service → Storage → Add Volume → mount at `/data`
5. Set env variable: `JWT_SECRET=your-secret-here`
6. Click Deploy → get your live URL 🎉

### Option B: Railway CLI
```bash
npm install -g @railway/cli
railway login
railway init
railway up
railway volume add --mount /data
railway variables set JWT_SECRET=your-secret-here
```

---

## 📡 API Reference

### Auth
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/signup` | ❌ | Register new user |
| POST | `/api/auth/login` | ❌ | Login, get JWT |
| GET | `/api/auth/me` | ✅ | Get current user |
| PUT | `/api/auth/profile` | ✅ | Update profile/password |

### Projects
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/projects` | ✅ | List user's projects |
| POST | `/api/projects` | ✅ | Create project |
| GET | `/api/projects/:id` | Member | Get project + members |
| PUT | `/api/projects/:id` | Admin | Update project |
| DELETE | `/api/projects/:id` | Admin | Delete project |
| POST | `/api/projects/:id/members` | Admin | Add member by email |
| PUT | `/api/projects/:id/members/:uid` | Admin | Change member role |
| DELETE | `/api/projects/:id/members/:uid` | Admin | Remove member |
| GET | `/api/projects/:id/activity` | Member | Activity log |

### Tasks
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/projects/:pid/tasks` | Member | List tasks (filterable) |
| POST | `/api/projects/:pid/tasks` | Member | Create task |
| GET | `/api/projects/:pid/tasks/:id` | Member | Get task + comments |
| PUT | `/api/projects/:pid/tasks/:id` | Member* | Update task |
| DELETE | `/api/projects/:pid/tasks/:id` | Member* | Delete task |
| POST | `/api/projects/:pid/tasks/:id/comments` | Member | Add comment |
| DELETE | `/api/projects/:pid/tasks/:id/comments/:cid` | Member* | Delete comment |

### System
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/health` | ❌ | Health check |
| GET | `/api/dashboard` | ✅ | Dashboard stats |
| GET | `/api/users` | Admin | List all users |
| PUT | `/api/users/:id/role` | Admin | Change user role |
| DELETE | `/api/users/:id` | Admin | Delete user |

---

## 🗂️ Project Structure

```
taskflow/
├── src/
│   ├── server.js          # Express app entry point
│   ├── database.js        # lowdb schema + query helpers
│   ├── auth.js            # JWT + middleware
│   ├── routes.auth.js     # /api/auth/*
│   ├── routes.projects.js # /api/projects/*
│   ├── routes.tasks.js    # /api/projects/:id/tasks/*
│   └── routes.misc.js     # /api/dashboard, /api/users
├── public/
│   └── index.html         # Full SPA frontend
├── data/                  # JSON database (gitignored)
├── package.json
├── railway.toml
└── README.md
```

---

## 🎥 Demo Video
> Record a 2–5 min walkthrough showing: signup, create project, add member, create tasks, kanban board, dashboard.

---

## 📝 Notes
- The `data/` directory is gitignored — Railway Volume provides persistence
- No build step required — pure HTML/CSS/JS frontend
- First user to sign up becomes the system Admin automatically
