import { Moon, Sun } from "lucide-react";
import { motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "../../i18n/I18nContext";
import { useEffectiveDark } from "../../hooks/useEffectiveDark";
import { useSettingsStore } from "../../store/settingsStore";

interface Particle {
  id: number;
  delay: number;
  duration: number;
}

export function ThemeAppearanceToggle() {
  const { t } = useTranslation();
  const saveSettings = useSettingsStore((s) => s.save);
  const loaded = useSettingsStore((s) => s.loaded);
  const effectiveDark = useEffectiveDark();

  const [mounted, setMounted] = useState(false);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && loaded && effectiveDark;

  const generateParticles = useCallback(() => {
    const newParticles: Particle[] = [];
    const particleCount = 3;
    for (let i = 0; i < particleCount; i++) {
      newParticles.push({
        id: i,
        delay: i * 0.1,
        duration: 0.6 + i * 0.1,
      });
    }
    setParticles(newParticles);
    setIsAnimating(true);
    window.setTimeout(() => {
      setIsAnimating(false);
      setParticles([]);
    }, 1000);
  }, []);

  const handleToggle = () => {
    generateParticles();
    void saveSettings({ theme: effectiveDark ? "light" : "dark" });
  };

  if (!mounted || !loaded) {
    return (
      <div className="relative inline-block">
        <div className="relative flex h-[43px] w-[70px] items-center rounded-full bg-neutral-200 p-1 dark:bg-neutral-700" />
      </div>
    );
  }

  return (
    <div className="relative inline-block">
      <motion.button
        type="button"
        onClick={handleToggle}
        className="relative flex h-[43px] w-[70px] items-center rounded-full p-[4px] transition-all duration-300 focus:outline-none"
        style={{
          background: isDark
            ? "radial-gradient(ellipse at top left, #1e293b 0%, #0f172a 40%, #020617 100%)"
            : "radial-gradient(ellipse at top left, #ffffff 0%, #f1f5f9 40%, #cbd5e1 100%)",
          boxShadow: isDark
            ? `
              inset 5px 5px 12px rgba(0, 0, 0, 0.9),
              inset -5px -5px 12px rgba(71, 85, 105, 0.4),
              inset 8px 8px 16px rgba(0, 0, 0, 0.7),
              inset -8px -8px 16px rgba(100, 116, 139, 0.2),
              inset 0 2px 4px rgba(0, 0, 0, 1),
              inset 0 -2px 4px rgba(71, 85, 105, 0.4),
              inset 0 0 20px rgba(0, 0, 0, 0.6),
              0 1px 1px rgba(255, 255, 255, 0.05),
              0 2px 4px rgba(0, 0, 0, 0.4),
              0 8px 16px rgba(0, 0, 0, 0.4),
              0 16px 32px rgba(0, 0, 0, 0.3),
              0 24px 48px rgba(0, 0, 0, 0.2)
            `
            : `
              inset 5px 5px 12px rgba(148, 163, 184, 0.5),
              inset -5px -5px 12px rgba(255, 255, 255, 1),
              inset 8px 8px 16px rgba(100, 116, 139, 0.3),
              inset -8px -8px 16px rgba(255, 255, 255, 0.9),
              inset 0 2px 4px rgba(148, 163, 184, 0.4),
              inset 0 -2px 4px rgba(255, 255, 255, 1),
              inset 0 0 20px rgba(203, 213, 225, 0.3),
              0 1px 2px rgba(255, 255, 255, 1),
              0 2px 4px rgba(0, 0, 0, 0.1),
              0 8px 16px rgba(0, 0, 0, 0.08),
              0 16px 32px rgba(0, 0, 0, 0.06),
              0 24px 48px rgba(0, 0, 0, 0.04)
            `,
          border: isDark ? "1px solid rgba(51, 65, 85, 0.6)" : "1px solid rgba(203, 213, 225, 0.6)",
        }}
        aria-label={isDark ? t("sidebar.switchToLight") : t("sidebar.switchToDark")}
        role="switch"
        aria-checked={isDark}
        whileTap={{ scale: 0.98 }}
      >
        <div
          className="pointer-events-none absolute inset-px rounded-full"
          style={{
            boxShadow: isDark
              ? "inset 0 2px 6px rgba(0, 0, 0, 0.9), inset 0 -1px 3px rgba(71, 85, 105, 0.3)"
              : "inset 0 2px 6px rgba(100, 116, 139, 0.4), inset 0 -1px 3px rgba(255, 255, 255, 0.8)",
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 rounded-full"
          style={{
            background: isDark
              ? `
                radial-gradient(ellipse at top, rgba(71, 85, 105, 0.15) 0%, transparent 50%),
                linear-gradient(to bottom, rgba(71, 85, 105, 0.2) 0%, transparent 30%, transparent 70%, rgba(0, 0, 0, 0.3) 100%)
              `
              : `
                radial-gradient(ellipse at top, rgba(255, 255, 255, 0.8) 0%, transparent 50%),
                linear-gradient(to bottom, rgba(255, 255, 255, 0.7) 0%, transparent 30%, transparent 70%, rgba(148, 163, 184, 0.15) 100%)
              `,
            mixBlendMode: "overlay",
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 rounded-full"
          style={{
            boxShadow: isDark
              ? "inset 0 0 15px rgba(0, 0, 0, 0.5)"
              : "inset 0 0 15px rgba(148, 163, 184, 0.2)",
          }}
        />
        <div className="absolute inset-0 flex items-center justify-between px-2">
          <Sun size={14} className={isDark ? "text-yellow-100" : "text-amber-600"} aria-hidden />
          <Moon size={14} className={isDark ? "text-yellow-100" : "text-slate-700"} aria-hidden />
        </div>

        <motion.div
          className="relative z-10 flex h-[30px] w-[30px] items-center justify-center overflow-hidden rounded-full"
          style={{
            background: isDark
              ? "linear-gradient(145deg, #64748b 0%, #475569 50%, #334155 100%)"
              : "linear-gradient(145deg, #ffffff 0%, #fefefe 50%, #f8fafc 100%)",
            boxShadow: isDark
              ? `
                inset 2px 2px 4px rgba(100, 116, 139, 0.4),
                inset -2px -2px 4px rgba(0, 0, 0, 0.8),
                inset 0 1px 1px rgba(255, 255, 255, 0.15),
                0 1px 2px rgba(255, 255, 255, 0.1),
                0 8px 32px rgba(0, 0, 0, 0.6),
                0 4px 12px rgba(0, 0, 0, 0.5),
                0 2px 4px rgba(0, 0, 0, 0.4)
              `
              : `
                inset 2px 2px 4px rgba(203, 213, 225, 0.3),
                inset -2px -2px 4px rgba(255, 255, 255, 1),
                inset 0 1px 2px rgba(255, 255, 255, 1),
                0 1px 2px rgba(255, 255, 255, 1),
                0 8px 32px rgba(0, 0, 0, 0.18),
                0 4px 12px rgba(0, 0, 0, 0.12),
                0 2px 4px rgba(0, 0, 0, 0.08)
              `,
            border: isDark ? "1px solid rgba(148, 163, 184, 0.3)" : "1px solid rgba(255, 255, 255, 0.9)",
          }}
          animate={{ x: isDark ? 32 : 0 }}
          transition={{
            type: "spring",
            stiffness: 300,
            damping: 20,
          }}
        >
          <div
            className="pointer-events-none absolute inset-0 rounded-full"
            style={{
              background:
                "linear-gradient(to bottom, rgba(255, 255, 255, 0.4) 0%, transparent 40%, rgba(0, 0, 0, 0.1) 100%)",
              mixBlendMode: "overlay",
            }}
          />
          {isAnimating &&
            particles.map((particle) => (
              <motion.div
                key={particle.id}
                className="pointer-events-none absolute inset-0 flex items-center justify-center"
              >
                <motion.div
                  className="absolute rounded-full"
                  style={{
                    width: "6px",
                    height: "6px",
                    background: isDark
                      ? "radial-gradient(circle, rgba(147, 197, 253, 0.5) 0%, rgba(147, 197, 253, 0) 70%)"
                      : "radial-gradient(circle, rgba(251, 191, 36, 0.7) 0%, rgba(251, 191, 36, 0) 70%)",
                    mixBlendMode: "normal",
                  }}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: isDark ? 6 : 8, opacity: [0, 1, 0] }}
                  transition={{
                    duration: isDark ? 0.5 : particle.duration,
                    delay: particle.delay,
                    ease: "easeOut",
                  }}
                >
                  <div
                    className="absolute inset-0 rounded-full opacity-40"
                    style={{
                      backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
                      mixBlendMode: "overlay",
                    }}
                  />
                </motion.div>
              </motion.div>
            ))}
          <div className="relative z-10">
            {isDark ? (
              <Moon size={14} className="text-yellow-200" aria-hidden />
            ) : (
              <Sun size={14} className="text-amber-500" aria-hidden />
            )}
          </div>
        </motion.div>
      </motion.button>
    </div>
  );
}
