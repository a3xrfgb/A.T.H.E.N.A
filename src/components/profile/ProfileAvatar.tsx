import { UserRound } from "lucide-react";
import { cn } from "../../lib/utils";
import { useProfilePictureUrl } from "../../hooks/useProfilePictureUrl";

type ProfileAvatarProps = {
  /** Outer circle (Tailwind classes). Defaults to a medium circle for home / inline use. */
  containerClassName?: string;
  /** Placeholder icon size when no photo. */
  iconClassName?: string;
  className?: string;
};

/**
 * Circular profile image matching Settings → Profile: border, shadow, object-cover, UserRound fallback.
 */
export function ProfileAvatar({
  containerClassName,
  iconClassName,
  className,
}: ProfileAvatarProps) {
  const avatarUrl = useProfilePictureUrl();

  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--app-border)] bg-[var(--app-bg)]",
        "shadow-[0_20px_50px_-12px_rgba(0,0,0,0.35),0_8px_24px_-8px_rgba(0,0,0,0.2)]",
        containerClassName ?? "h-20 w-20",
        className,
      )}
    >
      {avatarUrl ? (
        <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <UserRound
          className={cn("text-[var(--app-muted)]", iconClassName ?? "h-10 w-10")}
          strokeWidth={1}
        />
      )}
    </div>
  );
}
