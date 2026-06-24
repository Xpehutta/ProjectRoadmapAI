import os

# До импорта app.config: тесты на SQLite in-memory, уведомления выключены
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ["NOTIFICATIONS_ENABLED"] = "false"
