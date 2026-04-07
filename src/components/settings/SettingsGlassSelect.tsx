import * as Select from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../lib/utils";
import {
  settingsGlassSelectClassName,
  settingsGlassSelectContentClassName,
  settingsGlassSelectItemClassName,
} from "./settingsGlassSelectStyles";

export type SettingsGlassSelectOption = { value: string; label: ReactNode };

type Props = {
  value: string;
  onValueChange: (value: string) => void;
  options: SettingsGlassSelectOption[];
  id?: string;
  disabled?: boolean;
  /** Wrapper: spacing + width (e.g. `mt-2 w-full`) */
  className?: string;
  /** Extra classes on the trigger (padding, min-width) */
  triggerClassName?: string;
};

export function SettingsGlassSelect({
  value,
  onValueChange,
  options,
  id,
  disabled,
  className,
  triggerClassName,
}: Props) {
  return (
    <div className={className}>
      <Select.Root value={value} onValueChange={onValueChange} disabled={disabled}>
        <Select.Trigger
          id={id}
          className={cn(
            settingsGlassSelectClassName,
            "flex w-full min-w-0 items-center justify-between gap-2 text-left",
            triggerClassName,
          )}
        >
          <Select.Value className="min-w-0 flex-1 truncate" />
          <Select.Icon className="shrink-0 opacity-70" aria-hidden>
            <ChevronDown className="h-4 w-4" strokeWidth={2} />
          </Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Content
            position="popper"
            sideOffset={6}
            collisionPadding={12}
            className={settingsGlassSelectContentClassName}
          >
            <Select.Viewport className="max-h-[min(320px,45vh)] overflow-y-auto p-0.5">
              {options.map((o) => (
                <Select.Item
                  key={o.value === "" ? "__empty__" : o.value}
                  value={o.value}
                  className={settingsGlassSelectItemClassName}
                >
                  <Select.ItemText>{o.label}</Select.ItemText>
                  <Select.ItemIndicator className="absolute right-2 top-1/2 flex h-4 w-4 -translate-y-1/2 items-center justify-center text-accent">
                    <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
                  </Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </div>
  );
}
