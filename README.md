# Project Manager Roadmap Application

A Dockerized web application for project managers to plan, track, and visualize project roadmaps. The UI is in **Russian**; demo data is imported from `data/DataMarts.xlsx` (data-marts registry).

## Features

### Views (single project, shared data)

| View | Description |
|------|-------------|
| **Gantt** | Drag task bars and milestones; dependency arrows; date-shift indicators; priority badges and filter |
| **Timeline** | Editable dates per task; category swimlanes; indicative ranges |
| **Kanban** | Drag cards between status columns |
| **Table** | Spreadsheet-style inline editing; category grouping |
| **Backlog** | Auto-sorted list by RICE, Value/Effort, or MoSCoW |
| **Release board** | Kanban-style columns per release; drag tasks between releases |

### Task & schedule

- **Task management** — edit in the table, property drawer, or by dragging on Gantt/Timeline
- **Local save bar** — changes are staged locally; click **Сохранить** to persist (optimistic locking via `version`)
- **Dependency cascade** — shifting a predecessor auto-shifts successors (finish-to-start)
- **Partial completion** — sub-stage checklists (Этапы) with progress bars; add new stages from the drawer
- **Dual timelines** — committed (solid) vs indicative (dashed); toggle **Индикативные сроки**
- **Date-shift tracking** — red/green arrows when dates change; optional comments on why dates moved

### Organization

- **Categories (БВ)** — color coding or swimlane grouping on Gantt, Timeline, and Table
- **Collapsed groups** — aggregated actual + indicative date ranges on swimlane headers
- **Milestones** — diamond markers on Gantt/Timeline
- **Shared sources (Источники)** — reuse one data source (`Источник`) across multiple usages; shared dates, stages, and status sync across all linked rows (import deduplicates by source)
- **Releases** — group tasks into releases with target dates; release board view
- **Goals** — link tasks to project-level goals
- **Backlog scoring** — RICE, Value/Effort, MoSCoW fields with computed sort scores

### Projects & data

- **Multi-project** — start page to select or create projects
- **Excel import** — seed project **«Витрины данных»** from `data/DataMarts.xlsx` (categories = БВ, usages per row, shared components per Источник)
- **History & audit** — immutable log of date, cost, effort, and status changes
- **Comments** — per-task activity with timestamps

## Quick start

```bash
docker compose down --remove-orphans
docker compose up --build
```

Open **http://localhost:8080** in your browser.

> **Important:** Use port **8080**, not 8000. Port 80 may show a default nginx page if another web server is installed on your Mac.

On first visit:

1. Enter your display name (used for audit attribution).
2. Select or create a project on the start page, then click **Открыть проект**.

The demo project **«Витрины данных»** is seeded automatically from `data/DataMarts.xlsx` on first run.

### Re-import spreadsheet data

After editing `data/DataMarts.xlsx`:

```bash
SEED_REPLACE=1 docker compose run --rm backend python -m app.seed
```

This replaces the existing **«Витрины данных»** project with freshly imported tasks and shared components.

## Architecture

| Service  | Port | Description |
|----------|------|-------------|
| nginx    | 8080 | React SPA + API proxy (open this in the browser) |
| backend  | 8000 | FastAPI REST API (internal only) |
| db       | 5432 | PostgreSQL 16 (internal) |

```
Browser → nginx:8080 → /api/* → backend:8000 → PostgreSQL
                      → /*     → React static files
```

`data/` is mounted read-only at `/app/import-data` in the backend container for seed import.

## Development

### Backend

```bash
cd backend
pip install -r requirements.txt
export DATABASE_URL=postgresql://roadmap:roadmap@localhost:5432/roadmap
alembic upgrade head
python -m app.seed
uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Vite dev server proxies `/api` to `http://localhost:8000`.

### Tests

```bash
cd backend
pytest tests/
```

## API overview

| Endpoint | Description |
|----------|-------------|
| `GET /api/health` | Health check |
| `GET /api/projects` | List projects |
| `POST /api/projects` | Create project |
| `GET /api/projects/{id}` | Full project (tasks, categories, components, releases, goals, milestones, dependencies) |
| `PATCH /api/tasks/{id}` | Update task (`version` required; returns affected successors) |
| `GET/POST /api/tasks/{id}/sub-stages` | List or create stages (updates shared component stages when linked) |
| `GET /api/projects/{id}/components` | List shared data sources |
| `POST /api/tasks/{id}/link-component/{component_id}` | Link task to shared source |
| `POST /api/tasks/{id}/unlink-component` | Detach task (copies shared data locally) |
| `GET /api/tasks/{id}/history` | Task audit log |
| `GET /api/projects/{id}/audit` | Project audit log |
| `GET/POST /api/projects/{id}/releases` | Release CRUD |
| `GET/POST /api/projects/{id}/goals` | Goal CRUD |

Send the `X-User-Name` header with write requests for audit attribution.

## Environment variables

| Variable | Default |
|----------|---------|
| `DATABASE_URL` | `postgresql://roadmap:roadmap@db:5432/roadmap` |
| `SEED_REPLACE` | Set to `1` when running seed to replace existing demo project |

## Project layout

```
backend/          FastAPI app, Alembic migrations, DataMarts import
frontend/         React + TypeScript (Vite), Russian locale in src/locale/ru.ts
data/             DataMarts.xlsx — seed input (also mounted in Docker)
nginx/            Static SPA + reverse proxy
docker-compose.yml
```
