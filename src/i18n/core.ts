export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export function getNested(obj: unknown, path: string): unknown {
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur && typeof cur === "object" && p in (cur as object)) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return undefined;
    }
  }
  return cur;
}

export function deepMerge<T extends object>(base: T, override: DeepPartial<T> | undefined): T {
  if (!override) return base;
  const out = { ...base } as Record<string, unknown>;
  for (const key of Object.keys(override) as (keyof T)[]) {
    const bv = (base as Record<string, unknown>)[key as string];
    const ov = (override as Record<string, unknown>)[key as string];
    if (ov !== undefined && typeof ov === "object" && ov !== null && !Array.isArray(ov)) {
      out[key as string] = deepMerge(
        (typeof bv === "object" && bv !== null ? bv : {}) as object,
        ov as object,
      ) as unknown;
    } else if (ov !== undefined) {
      out[key as string] = ov as unknown;
    }
  }
  return out as T;
}

export function interpolate(
  template: string,
  vars?: Record<string, string | number | undefined>,
): string {
  if (!vars) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, k: string) =>
    vars[k] !== undefined && vars[k] !== null ? String(vars[k]) : "",
  );
}
