"""Emergency fallback only: English copy into om.ts. Prefer scripts/gen-om-locale.py for Afaan Oromoo."""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EN_PATH = ROOT / "src" / "i18n" / "flat" / "en.ts"
OUT = ROOT / "src" / "i18n" / "locales" / "om.ts"


def parse_en_ts(raw: str) -> dict[str, str]:
    out: dict[str, str] = {}
    for m in re.finditer(r'"([^"]+)":\s*"((?:[^"\\]|\\.)*)"', raw):
        out[m.group(1)] = m.group(2).replace("\\n", "\n")
    for m in re.finditer(r'"([^"]+)":\s*\n\s*"((?:[^"\\]|\\.)*)"\s*,', raw):
        out[m.group(1)] = m.group(2).replace("\\n", "\n")
    return out


def esc_ts(s: str) -> str:
    return s.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n")


def main() -> None:
    pairs = parse_en_ts(EN_PATH.read_text(encoding="utf-8"))
    keys = sorted(pairs.keys())
    lines = [
        "/** Oromo: machine translation unavailable; showing English until a proper locale is added. */",
        "export const omPatch: Record<string, string> = {",
    ]
    for k in keys:
        lines.append(f'  "{k}": "{esc_ts(pairs[k])}",')
    lines.append("};")
    OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("wrote", OUT, len(keys))


if __name__ == "__main__":
    main()
