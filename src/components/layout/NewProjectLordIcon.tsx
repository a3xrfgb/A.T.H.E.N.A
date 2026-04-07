import { createElement } from "react";
import { useEffectiveDark } from "../../hooks/useEffectiveDark";
import { cn } from "../../lib/utils";

const LORD_SRC = "https://cdn.lordicon.com/iuqrftwp.json";

/**
 * Lordicon “new project” animation (hover trigger). Sized for sidebar nav (~18px).
 * Primary color adapts to light/dark UI.
 */
export function NewProjectLordIcon({ className }: { className?: string }) {
  const dark = useEffectiveDark();
  const primary = dark ? "#c8c8d4" : "#545454";

  return createElement("lord-icon", {
    key: primary,
    src: LORD_SRC,
    trigger: "hover",
    colors: `primary:${primary}`,
    className: cn("inline-block shrink-0 align-middle", className),
    style: {
      width: 18,
      height: 18,
      display: "inline-block",
    },
  });
}
