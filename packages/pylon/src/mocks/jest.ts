/// <reference types="jest" />
import { createMockAegis } from "@lindorm/aegis/mocks/jest";
import { createMockAmphora } from "@lindorm/amphora/mocks/jest";
import { createMockConduit } from "@lindorm/conduit/mocks/jest";
import { createMockLogger } from "@lindorm/logger/mocks/jest";
import { createMockProteusSession } from "@lindorm/proteus/mocks/jest";
import {
  _createTestPylonCtx,
  type CreateTestPylonCtxOptions,
} from "./create-test-pylon-ctx.js";

export type { CreateTestPylonCtxOptions, TestPylonCtx } from "./create-test-pylon-ctx.js";

export const createTestPylonCtx = (options?: CreateTestPylonCtxOptions) =>
  _createTestPylonCtx(
    {
      mockFn: jest.fn,
      aegis: createMockAegis(),
      amphora: createMockAmphora(),
      logger: createMockLogger(),
      conduit: createMockConduit(),
      db: createMockProteusSession({}),
      kv: createMockProteusSession({}),
    },
    options,
  );
