"""Generate src/i18n/locales/ti.ts from flat en.ts using Google Translate (deep-translator)."""
from __future__ import annotations

import json
import re
import sys
import time
from pathlib import Path

try:
    from deep_translator import GoogleTranslator
except ImportError:
    print("pip install deep-translator", file=sys.stderr)
    raise

ROOT = Path(__file__).resolve().parents[1]
EN_PATH = ROOT / "src" / "i18n" / "flat" / "en.ts"
OUT_TS = ROOT / "src" / "i18n" / "locales" / "ti.ts"


def parse_en_ts(raw: str) -> dict[str, str]:
    """Extract string map from en.ts (handles continuation lines)."""
    out: dict[str, str] = {}
    i = 0
    lines = raw.splitlines()
    key_re = re.compile(r'^\s*"([^"]+)"\s*:\s*')
    while i < len(lines):
        line = lines[i]
        m = key_re.match(line)
        if not m:
            i += 1
            continue
        key = m.group(1)
        rest = line[m.end() :].strip()
        if rest.startswith('"'):
            # single-line value
            val, end_i = _parse_quoted(rest, lines, i)
            out[key] = val
            i = end_i
            continue
        # multiline: next lines until closing quote
        if rest == "":
            i += 1
            if i >= len(lines):
                break
            rest = lines[i].strip()
        val, end_i = _parse_quoted(rest, lines, i)
        out[key] = val
        i = end_i
    return out


def _parse_quoted(first: str, lines: list[str], start_i: int) -> tuple[str, int]:
    """Parse TS string starting with first (may be '"foo' or full '"foo"')."""
    if not first.startswith('"'):
        return "", start_i + 1
    buf: list[str] = []
    i = start_i
    s = first[1:]  # after opening "
    while True:
        # find closing unescaped "
        j = 0
        while j < len(s):
            if s[j] == "\\" and j + 1 < len(s):
                j += 2
                continue
            if s[j] == '"':
                buf.append(s[:j])
                return "".join(buf), i + 1
            j += 1
        buf.append(s)
        i += 1
        if i >= len(lines):
            return "".join(buf), i
        s = lines[i]


def protect_placeholders(s: str) -> tuple[str, dict[str, str]]:
    mapping: dict[str, str] = {}
    out = s
    for idx, m in enumerate(re.finditer(r"\{\{[^}]+\}\}", s)):
        token = f"__PH{idx}__"
        mapping[token] = m.group(0)
        out = out.replace(m.group(0), token, 1)
    return out, mapping


def translate_batch(translator: GoogleTranslator, texts: list[str]) -> list[str]:
    """Translate list; small delay to reduce rate limits."""
    out: list[str] = []
    for t in texts:
        if not t.strip():
            out.append(t)
            continue
        protected, ph = protect_placeholders(t)
        try:
            tr = translator.translate(protected)
            for k, v in ph.items():
                tr = tr.replace(k, v)
            out.append(tr)
        except Exception as e:
            print("translate error:", e, "|", t[:60], file=sys.stderr)
            out.append(t)
        time.sleep(0.12)
    return out


def main() -> None:
    raw = EN_PATH.read_text(encoding="utf-8")
    en_map = parse_en_ts(raw)
    if len(en_map) < 50:
        print("Parsed too few keys:", len(en_map), file=sys.stderr)
        sys.exit(1)
    keys = list(en_map.keys())
    values = [en_map[k] for k in keys]
    translator = GoogleTranslator(source="en", target="ti")
    translated = translate_batch(translator, values)
    ti_map = dict(zip(keys, translated, strict=True))

    lines = [
        "/** Auto-generated: English → Tigrinya (Google Translate). Regenerate: python scripts/gen_ti_locale.py */",
        "export const tiPatch: Record<string, string> = {",
    ]
    for k in keys:
        v = ti_map[k].replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n")
        lines.append(f'  "{k}": "{v}",')
    lines.append("};")
    lines.append("")
    OUT_TS.write_text("\n".join(lines), encoding="utf-8")
    print("Wrote", OUT_TS, "keys=", len(ti_map))


if __name__ == "__main__":
    main()
