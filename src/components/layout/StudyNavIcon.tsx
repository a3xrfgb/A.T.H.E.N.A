import type { SVGProps } from "react";
import { BOOK_OPEN_NAV_PATH } from "./bookOpenNavIconPath";

export function StudyNavIcon({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 50 50"
      className={className}
      aria-hidden
      {...props}
    >
      <path fill="currentColor" d={BOOK_OPEN_NAV_PATH} />
    </svg>
  );
}
