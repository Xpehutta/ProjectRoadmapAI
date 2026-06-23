from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.context import user_name_var
from app.routers import categories, chat, comments, components, dependencies, goals, milestones, notifications, projects, releases, stage_templates, sub_stages, table_columns, tasks
from app.services import notifications as _notifications  # noqa: F401 — регистрирует after_commit

app = FastAPI(title="Project Manager Roadmap API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def user_name_middleware(request: Request, call_next):
    user_name = request.headers.get("X-User-Name", "Anonymous")
    token = user_name_var.set(user_name)
    try:
        response = await call_next(request)
        return response
    finally:
        user_name_var.reset(token)


@app.get("/api/health")
def health():
    return {"status": "ok"}


app.include_router(chat.router, prefix="/api")
app.include_router(notifications.router, prefix="/api")
app.include_router(projects.router, prefix="/api")
app.include_router(components.router, prefix="/api")
app.include_router(categories.router, prefix="/api")
app.include_router(releases.router, prefix="/api")
app.include_router(goals.router, prefix="/api")
app.include_router(tasks.router, prefix="/api")
app.include_router(stage_templates.router, prefix="/api")
app.include_router(table_columns.router, prefix="/api")
app.include_router(sub_stages.router, prefix="/api")
app.include_router(dependencies.router, prefix="/api")
app.include_router(milestones.router, prefix="/api")
app.include_router(comments.router, prefix="/api")
