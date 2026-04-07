#!/usr/bin/env python3
"""Optional audio summary for Athena attachments (requires librosa + numpy)."""
import json
import sys


def main() -> None:
    path = sys.argv[1]
    try:
        import librosa  # type: ignore
        import numpy as np  # type: ignore
    except ImportError as e:
        print(
            json.dumps(
                {
                    "ok": False,
                    "error": f"Missing librosa. Install with: pip install librosa numpy soundfile ({e})",
                }
            )
        )
        return

    try:
        y, sr = librosa.load(path, sr=None, mono=True)
        dur = float(librosa.get_duration(y=y, sr=sr))
        rms = float(np.sqrt(np.mean(np.square(y)))) if len(y) else 0.0
        summary = (
            "[Audio analysis via librosa]\n"
            f"Duration: {dur:.2f}s, sample rate: {int(sr)} Hz, RMS level: {rms:.6f}.\n"
            "Use this when answering about the attached audio."
        )
        print(json.dumps({"ok": True, "summary": summary}))
    except Exception as e:
        print(json.dumps({"ok": False, "error": str(e)}))


if __name__ == "__main__":
    main()
