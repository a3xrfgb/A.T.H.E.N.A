import { isTauri } from "@tauri-apps/api/core";
import { remove } from "@tauri-apps/plugin-fs";
import { open } from "@tauri-apps/plugin-dialog";
import { Camera, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "../../i18n/I18nContext";
import { api } from "../../lib/tauri";
import { ProfileAvatar } from "../profile/ProfileAvatar";
import { useSettingsStore } from "../../store/settingsStore";
import { useUiStore } from "../../store/uiStore";
import { cn } from "../../lib/utils";

export function SettingsProfilePanel() {
  const { t } = useTranslation();
  const settings = useSettingsStore((s) => s.settings);
  const save = useSettingsStore((s) => s.save);
  const pushToast = useUiStore((s) => s.pushToast);
  const fileRef = useRef<HTMLInputElement>(null);

  const [localAbout, setLocalAbout] = useState(settings.profileAboutMe);
  const [localCustom, setLocalCustom] = useState(settings.personalCustomInstructions);
  const [localMore, setLocalMore] = useState(settings.personalMoreAboutYou);

  useEffect(() => {
    setLocalAbout(settings.profileAboutMe);
  }, [settings.profileAboutMe]);
  useEffect(() => {
    setLocalCustom(settings.personalCustomInstructions);
  }, [settings.personalCustomInstructions]);
  useEffect(() => {
    setLocalMore(settings.personalMoreAboutYou);
  }, [settings.personalMoreAboutYou]);

  const pickImage = async () => {
    try {
      if (isTauri()) {
        const selected = await open({
          multiple: false,
          filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "gif", "svg"] }],
        });
        if (selected === null || Array.isArray(selected)) return;
        const dest = await api.importProfilePicture(selected);
        await save({ profilePicturePath: dest });
        pushToast(t("settings.profile.photoSaved"), "success");
        return;
      }
      fileRef.current?.click();
    } catch (e) {
      pushToast(String(e), "error");
    }
  };

  const onFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 1_500_000) {
      pushToast(t("profile.imageTooLarge"), "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const data = String(reader.result ?? "");
      void save({ profilePicturePath: data }).then(() =>
        pushToast(t("settings.profile.photoSaved"), "success"),
      );
    };
    reader.readAsDataURL(file);
  };

  const removeProfilePhoto = async () => {
    const path = settings.profilePicturePath?.trim();
    if (!path) return;
    try {
      if (isTauri() && !path.startsWith("data:")) {
        try {
          await remove(path);
        } catch {
          /* file missing or outside FS scope — still clear setting */
        }
      }
      await save({ profilePicturePath: "" });
      pushToast(t("settings.profile.photoRemoved"), "info");
    } catch (e) {
      pushToast(String(e), "error");
    }
  };

  const input =
    "w-full border-0 border-b border-[var(--app-border)]/70 bg-transparent px-0 py-2 text-sm text-[var(--app-text)] outline-none transition placeholder:text-[var(--app-muted)] focus:border-[#0080ff] focus:ring-0";
  const textarea =
    "w-full rounded-md border border-[var(--app-border)]/45 bg-transparent px-3 py-2 text-sm text-[var(--app-text)] outline-none transition placeholder:text-[var(--app-muted)] focus:border-[#0080ff]/70 focus:ring-1 focus:ring-[#0080ff]/15";
  const label = "text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--app-muted)]";

  return (
    <div className="px-8 py-10">
      <h3 className="text-lg font-semibold tracking-tight text-[var(--app-text)]">Profile</h3>
      <p className="mt-1 max-w-xl text-sm text-[var(--app-muted)]">
        Basic info and how the model should treat you.
      </p>

      <div className="mx-auto mt-8 flex max-w-lg flex-col items-center">
        <ProfileAvatar
          containerClassName="h-48 w-48"
          iconClassName="h-[4.5rem] w-[4.5rem]"
          className="shadow-none ring-1 ring-[var(--app-border)]/50"
        />
        <div className="mt-5 flex flex-wrap items-center justify-center gap-1">
          <button
            type="button"
            onClick={() => void pickImage()}
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-[var(--app-text)] transition hover:bg-[var(--app-border)]/25"
          >
            <Camera className="h-3.5 w-3.5 opacity-70" strokeWidth={2} />
            {settings.profilePicturePath ? t("settings.profile.changePhoto") : t("settings.profile.addPhoto")}
          </button>
          {settings.profilePicturePath ? (
            <button
              type="button"
              onClick={() => void removeProfilePhoto()}
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-red-600/90 transition hover:bg-red-500/10 dark:text-red-400/90"
            >
              <Trash2 className="h-3.5 w-3.5 opacity-70" strokeWidth={2} />
              {t("settings.profile.removePhoto")}
            </button>
          ) : null}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => void onFileInput(e)}
        />
      </div>

      <div className="mx-auto mt-10 max-w-lg space-y-6">
        <div>
          <label className={label} htmlFor="pf-name">
            Full name
          </label>
          <input
            id="pf-name"
            className={cn(input, "mt-1")}
            value={settings.profileFullName}
            onChange={(e) =>
              void save({ profileFullName: e.target.value }).catch((err) =>
                pushToast(String(err), "error"),
              )
            }
          />
        </div>
        <div>
          <label className={label} htmlFor="pf-nick">
            Nick name
          </label>
          <input
            id="pf-nick"
            className={cn(input, "mt-1")}
            value={settings.profileNickname}
            onChange={(e) =>
              void save({ profileNickname: e.target.value }).catch((err) =>
                pushToast(String(err), "error"),
              )
            }
          />
        </div>
        <div>
          <label className={label} htmlFor="pf-job">
            Occupation
          </label>
          <input
            id="pf-job"
            className={cn(input, "mt-1")}
            value={settings.profileOccupation}
            onChange={(e) =>
              void save({ profileOccupation: e.target.value }).catch((err) =>
                pushToast(String(err), "error"),
              )
            }
          />
        </div>
        <div>
          <label className={label} htmlFor="pf-about">
            About me
          </label>
          <textarea
            id="pf-about"
            rows={3}
            className={cn(textarea, "mt-2 resize-y")}
            value={localAbout}
            onChange={(e) => setLocalAbout(e.target.value)}
            onBlur={(e) =>
              void save({ profileAboutMe: e.target.value }).catch((err) =>
                pushToast(String(err), "error"),
              )
            }
          />
        </div>
      </div>

      <div className="mx-auto mt-14 max-w-lg border-t border-[var(--app-border)]/60 pt-8">
        <h4 className="text-sm font-semibold text-[var(--app-text)]">Personalization</h4>
        <p className="mt-1 text-xs leading-relaxed text-[var(--app-muted)]">
          Instructions and context sent with chats (when wired to the model).
        </p>

        <div className="mt-6 space-y-7">
          <div>
            <label className={label} htmlFor="pers-custom">
              Custom instructions
            </label>
            <p className="mt-1 text-[11px] leading-snug text-[var(--app-muted)]/90">
              Tell the AI how to act (e.g. be direct; don&apos;t sugar-coat).
            </p>
            <textarea
              id="pers-custom"
              rows={4}
              className={cn(textarea, "mt-2 resize-y")}
              placeholder="Tell it like it is; don't sugar-coat responses."
              value={localCustom}
              onChange={(e) => setLocalCustom(e.target.value)}
              onBlur={(e) =>
                void save({ personalCustomInstructions: e.target.value }).catch((err) =>
                  pushToast(String(err), "error"),
                )
              }
            />
          </div>
          <div>
            <label className={label} htmlFor="pers-more">
              More about you
            </label>
            <p className="mt-1 text-[11px] leading-snug text-[var(--app-muted)]/90">
              Background the model can use to stay relevant.
            </p>
            <textarea
              id="pers-more"
              rows={4}
              className={cn(textarea, "mt-2 resize-y")}
              placeholder="Hobbies, goals, constraints…"
              value={localMore}
              onChange={(e) => setLocalMore(e.target.value)}
              onBlur={(e) =>
                void save({ personalMoreAboutYou: e.target.value }).catch((err) =>
                  pushToast(String(err), "error"),
                )
              }
            />
          </div>
          <div className="border-t border-[var(--app-border)]/50 pt-7">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--app-muted)]">
                  Memory
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-[var(--app-muted)]/90">
                  When enabled, recent context can be stored locally for better continuity (stored in
                  settings; expand with a dedicated store later).
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={settings.personalMemoryEnabled}
                onClick={() =>
                  void save({ personalMemoryEnabled: !settings.personalMemoryEnabled }).catch((e) =>
                    pushToast(String(e), "error"),
                  )
                }
                className={cn(
                  "relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors",
                  settings.personalMemoryEnabled ? "bg-[#0080ff]" : "bg-[var(--app-border)]/80",
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 block h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
                    settings.personalMemoryEnabled ? "translate-x-5" : "translate-x-0.5",
                  )}
                />
              </button>
            </div>
            {settings.personalMemoryEnabled ? (
              <textarea
                rows={3}
                className={cn(textarea, "mt-3 resize-y text-xs")}
                placeholder="Optional notes for what to remember (prototype field)."
                value={settings.personalMemoryBlob}
                onChange={(e) =>
                  void save({ personalMemoryBlob: e.target.value }).catch((err) =>
                    pushToast(String(err), "error"),
                  )
                }
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
