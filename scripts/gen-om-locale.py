"""
Generate src/i18n/locales/om.ts — full Afaan Oromo via Google Translate (deep-translator, target code om).

Usage: python scripts/gen-om-locale.py
"""
from __future__ import annotations

import re
import time
from pathlib import Path

from deep_translator import GoogleTranslator

ROOT = Path(__file__).resolve().parent.parent
EN_PATH = ROOT / "src" / "i18n" / "flat" / "en.ts"
OUT_PATH = ROOT / "src" / "i18n" / "locales" / "om.ts"
CHUNK = 30


def parse_en_ts(raw: str) -> dict[str, str]:
    out: dict[str, str] = {}
    for m in re.finditer(r'"([^"]+)":\s*"((?:[^"\\]|\\.)*)"', raw):
        out[m.group(1)] = m.group(2).replace("\\n", "\n")
    for m in re.finditer(r'"([^"]+)":\s*\n\s*"((?:[^"\\]|\\.)*)"\s*,', raw):
        out[m.group(1)] = m.group(2).replace("\\n", "\n")
    return out


def esc_ts(s: str) -> str:
    return s.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n")


# Google mangles {{count}}; swap before translate, restore after.
PH_COUNT = "XXXXXCNTXXXXX"


def protect_placeholders(s: str) -> str:
    return s.replace("{{count}}", PH_COUNT)


def restore_placeholders_after(s: str) -> str:
    out = s.replace(PH_COUNT, "{{count}}")
    # MT sometimes splits or alters the token
    out = re.sub(r"X{3,}CNTX{3,}", "{{count}}", out, flags=re.IGNORECASE)
    return out


def main() -> None:
    raw = EN_PATH.read_text(encoding="utf-8")
    pairs = parse_en_ts(raw)
    keys_sorted = sorted(pairs.keys())
    print("parsed", len(pairs), "keys; translating to Afaan Oromo (om)...")

    tr = GoogleTranslator(source="en", target="om")
    vals = [protect_placeholders(pairs[k]) for k in keys_sorted]
    out_vals: list[str] = []

    for i in range(0, len(vals), CHUNK):
        chunk = vals[i : i + CHUNK]
        try:
            batch_out = tr.translate_batch(chunk)
        except Exception as e:  # noqa: BLE001
            print("batch error at", i, e)
            batch_out = []
            for v in chunk:
                try:
                    batch_out.append(tr.translate(v))
                except Exception as e2:  # noqa: BLE001
                    print("single error", e2)
                    batch_out.append(v)
                time.sleep(0.08)
        if len(batch_out) != len(chunk):
            print("len mismatch", len(batch_out), len(chunk), "— padding with source")
            while len(batch_out) < len(chunk):
                batch_out.append(chunk[len(batch_out)])
        out_vals.extend(batch_out)
        time.sleep(0.2)
        print(f"  … {min(i + CHUNK, len(vals))}/{len(vals)}")

    fixed: list[str] = [restore_placeholders_after(trans) for trans in out_vals]

    lines = [
        "/** Afaan Oromoo — generated from en.ts via Google Translate (target: om). Review critical UX copy. */",
        "export const omPatch: Record<string, string> = {",
    ]
    for key, val in zip(keys_sorted, fixed, strict=True):
        lines.append(f'  "{key}": "{esc_ts(val)}",')
    lines.append("};")

    OUT_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("wrote", OUT_PATH)


if __name__ == "__main__":
    main()
