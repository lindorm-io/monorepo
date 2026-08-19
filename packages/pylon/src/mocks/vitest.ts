import { createMockAegis } from "@lindorm/aegis/mocks/vitest";
import { createMockAmphora } from "@lindorm/amphora/mocks/vitest";
import { createMockConduit } from "@lindorm/conduit/mocks/vitest";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { createMockProteusSession } from "@lindorm/proteus/mocks/vitest";
import { vi, type Mock } from "vitest";
import {
  _createTestPylonCtx,
  type CreateTestPylonCtxOptions,
  type TestPylonCtx as BaseTestPylonCtx,
} from "./create-test-pylon-ctx.js";

export type { CreateTestPylonCtxOptions } from "./create-test-pylon-ctx.js";

/**
 * The context with its mock members bound to VITEST's `Mock` — same exported
 * name as before, so nothing a consumer writes changes; `ctx.auth.introspect`
 * simply now carries the mock API alongside its real call signature.
 */
export type TestPylonCtx = BaseTestPylonCtx<Mock>;

export const createTestPylonCtx = async (
  options?: CreateTestPylonCtxOptions,
): Promise<TestPylonCtx> =>
  _createTestPylonCtx<Mock>(
    {
      mockFn: vi.fn,
      aegis: createMockAegis(),
      amphora: createMockAmphora(),
      logger: createMockLogger(),
      conduit: createMockConduit(),
      db: await createMockProteusSession(),
      kv: await createMockProteusSession(),
      cache: await createMockProteusSession(),
    },
    options,
  );
