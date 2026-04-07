import re
from pathlib import Path

raw = Path(__file__).resolve().parent.parent / "src" / "i18n" / "flat" / "en.ts"
text = raw.read_text(encoding="utf-8")


def parse(raw: str) -> dict[str, str]:
    out: dict[str, str] = {}
    for m in re.finditer(r'"([^"]+)":\s*"((?:[^"\\]|\\.)*)"', raw):
        out[m.group(1)] = m.group(2)
    for m in re.finditer(r'"([^"]+)":\s*\n\s*"((?:[^"\\]|\\.)*)"\s*,', raw):
        out[m.group(1)] = m.group(2)
    return out


p = parse(text)
print("keys", len(p))
for k in ("settings.general.lead", "sidebar.bulkRenameDesc", "settings.profile.memoryHint"):
    print(k, "OK" if k in p else "MISSING")
