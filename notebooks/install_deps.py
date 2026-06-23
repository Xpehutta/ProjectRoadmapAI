#!/usr/bin/env python3
"""Установка зависимостей для notebooks/test_chatbot.ipynb в текущий Python."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

REQUIREMENTS = Path(__file__).resolve().parent / "requirements.txt"


def main() -> None:
    print(f"Python: {sys.executable}")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", str(REQUIREMENTS)])
    from gigachat import GigaChat  # noqa: F401
    import psycopg  # noqa: F401

    print("OK: зависимости notebook и backend установлены")


if __name__ == "__main__":
    main()
