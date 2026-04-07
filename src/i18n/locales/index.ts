import { esPatch } from "./es";
import { frPatch } from "./fr";
import { itPatch } from "./it";
import { ptPatch } from "./pt";
import { ruPatch } from "./ru";
import { zhPatch } from "./zh";
import { hiPatch } from "./hi";
import { arPatch } from "./ar";
import { bnPatch } from "./bn";
import { urPatch } from "./ur";
import { amPatch } from "./am";
import { omPatch } from "./om";
import { tiPatch } from "./ti";

/** Merged over `en` in `getMessages` — missing keys fall back to English. */
export const LOCALE_PATCHES: Record<string, Record<string, string>> = {
  es: esPatch,
  fr: frPatch,
  it: itPatch,
  pt: ptPatch,
  ru: ruPatch,
  zh: zhPatch,
  hi: hiPatch,
  ar: arPatch,
  bn: bnPatch,
  ur: urPatch,
  am: amPatch,
  om: omPatch,
  ti: tiPatch,
};
