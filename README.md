# TaskFlow - Team Task Manager

A web app to manage projects and tasks with your team.

## What it does

- Sign up / log in
- Create projects and invite teammates
- Create tasks, assign them, set deadlines and priority
- Track progress with a Kanban board
- Comment on tasks
- Admin can manage all users and projects

## Tech Used

- Node.js + Express (backend)
- JSON file database (no setup needed)
- Vanilla JS (frontend, no framework)
- JWT for auth

## Run Locally

```bash
npm install
npm start
```

Open http://localhost:3000

First person to sign up becomes Admin automatically.

## Deploy on Railway

1. Push code to GitHub
2. Go to railway.app → New Project → Deploy from GitHub
3. Select your repo
4. Go to service Settings → Networking → Generate Domain
5. Add a Volume with mount path `/data`
6. Set environment variable: `JWT_SECRET=anything-random`
7. Redeploy

## Environment Variables

| Variable | Description |
|---|---|
| `JWT_SECRET` | Secret key for auth tokens |
| `PORT` | Port to run on (default: 3000) |

## Project Structure

```
taskflow/
├── src/
│   ├── server.js        # main server
│   ├── database.js      # data layer
│   ├── auth.js          # login/auth
│   └── routes.*.js      # API routes
├── public/
│   └── index.html       # frontend
└── railway.toml         # deployment config
```