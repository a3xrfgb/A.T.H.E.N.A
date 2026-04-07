import { useEffectiveDark } from "../../hooks/useEffectiveDark";
import { cn } from "../../lib/utils";

export function AthenaLogo({
  className,
  alt = "",
}: {
  className?: string;
  alt?: string;
}) {
  const effectiveDark = useEffectiveDark();
  return (
    <img
      src="/athena-logo.png"
      alt={alt}
      className={cn(
        className,
        effectiveDark ? "brightness-0 invert" : "brightness-0",
      )}
      draggable={false}
    />
  );
}
