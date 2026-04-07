import { convertFileSrc, isTauri } from "@tauri-apps/api/core";
import { readFile } from "@tauri-apps/plugin-fs";
import { useEffect, useRef, useState } from "react";
import { useSettingsStore } from "../store/settingsStore";

function mimeForPath(p: string) {
  const lower = p.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  return "image/jpeg";
}

/** Resolves `settings.profilePicturePath` to a displayable URL (data URL, blob, or Tauri asset). */
export function useProfilePictureUrl(): string | null {
  const path = useSettingsStore((s) => s.settings.profilePicturePath);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    const trimmed = path?.trim();
    if (!trimmed) {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
      setAvatarUrl(null);
      return;
    }
    if (trimmed.startsWith("data:")) {
      setAvatarUrl(trimmed);
      return;
    }
    if (!isTauri()) {
      setAvatarUrl(null);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const bytes = await readFile(trimmed);
        if (cancelled) return;
        if (blobUrlRef.current) {
          URL.revokeObjectURL(blobUrlRef.current);
          blobUrlRef.current = null;
        }
        const blob = new Blob([bytes], { type: mimeForPath(trimmed) });
        const url = URL.createObjectURL(blob);
        blobUrlRef.current = url;
        setAvatarUrl(url);
      } catch {
        if (cancelled) return;
        try {
          setAvatarUrl(convertFileSrc(trimmed));
        } catch {
          setAvatarUrl(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [path]);

  return avatarUrl;
}
