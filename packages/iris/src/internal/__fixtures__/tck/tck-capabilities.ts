import { IrisSource } from "../../../classes/IrisSource.js";
import type { IrisSourceOptions } from "../../../types/index.js";
import type { TckCapabilities } from "./types.js";

type TestOnlyCapabilities = Pick<
  TckCapabilities,
  "strictOrdering" | "evenDistribution" | "exactlyOnce"
>;

/**
 * Build a harness's TCK capability matrix by READING the driver's own runtime
 * declaration off `source.capabilities` — the single source of truth — and
 * layering on only the test-only observability knobs the harness still owns.
 *
 * The probe source is never connected: `source.capabilities` resolves from the
 * driver type pre-connect, so no broker client is created. Reading the promoted
 * flags this way (rather than hand-declaring them) means the TCK gates on the
 * driver's honest declaration and cannot silently drift from what it supports.
 */
export const tckCapabilities = (
  options: IrisSourceOptions,
  testOnly: TestOnlyCapabilities,
): TckCapabilities => ({
  ...new IrisSource(options).capabilities,
  ...testOnly,
});
