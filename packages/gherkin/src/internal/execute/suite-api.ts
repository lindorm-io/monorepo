import { isUndefined } from "@lindorm/is";
import { afterAll, beforeAll, describe, test } from "vitest";
import type { SuiteApi } from "./types.js";

/** vitest's real surface — the default when the generated module passes no api. */
export const vitestSuiteApi: SuiteApi = { afterAll, beforeAll, describe, test };

export const resolveSuiteApi = (api: SuiteApi | undefined): SuiteApi =>
  isUndefined(api) ? vitestSuiteApi : api;
