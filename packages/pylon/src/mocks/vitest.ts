import { createMockAegis } from "@lindorm/aegis/mocks/vitest";
import { createMockAmphora } from "@lindorm/amphora/mocks/vitest";
import { createMockConduit } from "@lindorm/conduit/mocks/vitest";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { createMockProteusSession } from "@lindorm/proteus/mocks/vitest";
import { vi } from "vitest";
import {
  _createTestPylonCtx,
  type CreateTestPylonCtxOptions,
} from "./create-test-pylon-ctx.js";

export type { CreateTestPylonCtxOptions, TestPylonCtx } from "./create-test-pylon-ctx.js";

export const createTestPylonCtx = (options?: CreateTestPylonCtxOptions) =>
  _createTestPylonCtx(
    {
      mockFn: vi.fn,
      aegis: createMockAegis(),
      amphora: createMockAmphora(),
      logger: createMockLogger(),
      conduit: createMockConduit(),
      db: createMockProteusSession({}),
      kv: createMockProteusSession({}),
    },
    options,
  );
