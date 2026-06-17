"""Regenerate data/stage_templates.json from data/Template_substages.numbers."""

from __future__ import annotations

import json
from pathlib import Path

from numbers_parser import Document

ROOT = Path(__file__).resolve().parents[1]
NUMBERS_PATH = ROOT / "data" / "Template_substages.numbers"
OUTPUT_PATH = ROOT / "data" / "stage_templates.json"


def extract_templates() -> list[dict]:
    doc = Document(NUMBERS_PATH)
    templates: list[dict] = []
    for sheet in doc.sheets:
        for table in sheet.tables:
            current_group = None
            current_phase = None
            for r in range(1, table.num_rows):
                c0 = table.cell(r, 0).value
                c1 = table.cell(r, 1).value
                c2 = table.cell(r, 2).value
                if isinstance(c0, str) and c0.strip() and c1 is None and c2 is None:
                    current_group = c0.strip()
                    current_phase = None
                    continue
                if c0 is not None and isinstance(c1, str) and c2 is None:
                    current_phase = c1.strip()
                    continue
                if c2 and str(c2).strip():
                    name = str(c2).strip()
                    parts = [p for p in [current_group, current_phase] if p]
                    group = " / ".join(parts) if parts else None
                    full_label = " / ".join([*parts, name]) if parts else name
                    templates.append({"name": name, "group": group, "full_label": full_label})
    return templates


def main() -> None:
    templates = extract_templates()
    OUTPUT_PATH.write_text(json.dumps(templates, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(templates)} templates to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
