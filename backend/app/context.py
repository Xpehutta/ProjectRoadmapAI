from contextvars import ContextVar

user_name_var: ContextVar[str] = ContextVar("user_name", default="Anonymous")
