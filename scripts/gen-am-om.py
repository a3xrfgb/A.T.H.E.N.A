"""Generate am.ts and om.ts only (batch). Om falls back to English if translation fails."""
from __future__ import annotations

import re
import time
from pathlib import Path

from deep_translator import GoogleTranslator

ROOT = Path(__file__).resolve().parent.parent
EN_PATH = ROOT / "src" / "i18n" / "flat" / "en.ts"
OUT_DIR = ROOT / "src" / "i18n" / "locales"
CHUNK = 35


def parse_en_ts(raw: str) -> dict[str, str]:
    out: dict[str, str] = {}
    for m in re.finditer(r'"([^"]+)":\s*"((?:[^"\\]|\\.)*)"', raw):
        out[m.group(1)] = m.group(2).replace("\\n", "\n")
    for m in re.finditer(r'"([^"]+)":\s*\n\s*"((?:[^"\\]|\\.)*)"\s*,', raw):
        out[m.group(1)] = m.group(2).replace("\\n", "\n")
    return out


def esc_ts(s: str) -> str:
    return s.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n")


def write_lang(stem: str, dest: str, pairs: dict[str, str], keys_sorted: list[str]) -> None:
    var = f"{stem}Patch"
    try:
        tr = GoogleTranslator(source="en", target=dest)
    except Exception as e:  # noqa: BLE001
        print("no translator", stem, e)
        return
    lines = [
        f"/** Auto-generated from en.ts (→ {dest}). */",
        f"export const {var}: Record<string, string> = {{",
    ]
    vals = [pairs[k] for k in keys_sorted]
    out_vals: list[str] = []
    for i in range(0, len(vals), CHUNK):
        chunk = vals[i : i + CHUNK]
        try:
            batch_out = tr.translate_batch(chunk)
        except Exception as e:  # noqa: BLE001
            print("batch fail", stem, e, "fallback per string")
            batch_out = []
            for v in chunk:
                try:
                    batch_out.append(tr.translate(v))
                except Exception:
                    batch_out.append(v)
                time.sleep(0.05)
        if len(batch_out) != len(chunk):
            print("len fix", stem)
            batch_out = chunk
        out_vals.extend(batch_out)
        time.sleep(0.2)

    for k, v in zip(keys_sorted, out_vals, strict=True):
        lines.append(f'  "{k}": "{esc_ts(v)}",')
    lines.append("};")
    (OUT_DIR / f"{stem}.ts").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("wrote", stem)


def main() -> None:
    raw = EN_PATH.read_text(encoding="utf-8")
    pairs = parse_en_ts(raw)
    keys_sorted = sorted(pairs.keys())
    write_lang("am", "am", pairs, keys_sorted)
    # Oromo: try 'om' — may be unsupported; fallback English per key
    try:
        GoogleTranslator(source="en", target="om")
        write_lang("om", "om", pairs, keys_sorted)
    except Exception as e:  # noqa: BLE001
        print("om not supported, using English copy", e)
        var = "omPatch"
        lines = [
            "/** Oromo: translator unavailable; English fallback until localized. */",
            f"export const {var}: Record<string, string> = {{",
        ]
        for k in keys_sorted:
            lines.append(f'  "{k}": "{esc_ts(pairs[k])}",')
        lines.append("};")
        (OUT_DIR / "om.ts").write_text("\n".join(lines) + "\n", encoding="utf-8")
        print("wrote om (en fallback)")


if __name__ == "__main__":
    main()
