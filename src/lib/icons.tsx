/** Remote icon assets (Icons8 / external) */
export const ICONS = {
  themeDark:
    "https://img.icons8.com/ios-filled/50/do-not-disturb-2.png",
  themeLight:
    "https://img.icons8.com/external-glyph-silhouettes-icons-papa-vector/78/external-Light-Mode-interface-glyph-silhouettes-icons-papa-vector.png",
  lockLocked: "https://img.icons8.com/ios-filled/50/lock-2.png",
  lockUnlocked: "https://img.icons8.com/ios/50/unlock-2.png",
  inspirationDraw:
    "https://img.icons8.com/ios/50/drawing--v2.png",
  notesPastel:
    "https://img.icons8.com/pastel-glyph/64/note.png",
} as const;

export function RemoteIcon({
  src,
  alt,
  className,
  size = 24,
}: {
  src: string;
  alt: string;
  className?: string;
  size?: number;
}) {
  return (
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      className={className}
      draggable={false}
    />
  );
}
