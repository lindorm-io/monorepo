/// <reference types="jest" />
import { createMockAegis } from "@lindorm/aegis/mocks/jest";
import { createMockAmphora } from "@lindorm/amphora/mocks/jest";
import { createMockConduit } from "@lindorm/conduit/mocks/jest";
import { createMockLogger } from "@lindorm/logger/mocks/jest";
import { createMockProteusSession } from "@lindorm/proteus/mocks/jest";
import {
  _createTestPylonCtx,
  type CreateTestPylonCtxOptions,
  type TestPylonCtx as BaseTestPylonCtx,
} from "./create-test-pylon-ctx.js";

export type { CreateTestPylonCtxOptions } from "./create-test-pylon-ctx.js";

/** The context with its mock members bound to JEST's `Mock` — see the vitest twin. */
export type TestPylonCtx = BaseTestPylonCtx<jest.Mock>;

export const createTestPylonCtx = async (
  options?: CreateTestPylonCtxOptions,
): Promise<TestPylonCtx> =>
  _createTestPylonCtx<jest.Mock>(
    {
      mockFn: jest.fn,
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
