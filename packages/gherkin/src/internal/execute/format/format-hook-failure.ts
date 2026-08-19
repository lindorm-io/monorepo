import { isUndefined } from "@lindorm/is";
import type { HookKind } from "../../metadata/staged.js";
import { formatRemainingSteps } from "./format-remaining-steps.js";
import { joinBlocks } from "./join-blocks.js";

export type HookFailureFormat = {
  /** Prebuilt identity + position block (format-hook-anchor.ts). */
  anchor: string;
  kind: HookKind;
  /** The original error's message — preserved verbatim, never re-worded. */
  message: string;
  /**
   * Steps skipped because of the throw — absent for after-the-fact hooks
   * (`@AfterScenario`, feature hooks), where nothing is skipped by it.
   */
  remaining?: number;
};

export const formatHookFailure = ({
  anchor,
  kind,
  message,
  remaining,
}: HookFailureFormat): string =>
  joinBlocks([
    `@${kind} hook failed`,
    anchor,
    message,
    isUndefined(remaining) ? "" : formatRemainingSteps(remaining),
  ]);
