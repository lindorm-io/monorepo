import type { Answers } from "./types.js";

export const buildTestCtxFile = (_answers: Answers): string => {
  const lines: Array<string> = [
    `import {`,
    `  createTestPylonCtx,`,
    `  type CreateTestPylonCtxOptions,`,
    `} from "@lindorm/pylon/mocks/vitest";`,
    `import type { ServerHttpContext } from "../types/context.js";`,
    ``,
    `// A ready-made ServerHttpContext for tests: infrastructure is mocked, and`,
    `// ctx.db / ctx.kv are stateful in-memory Proteus mocks (writes persist, reads`,
    `// reflect them) — seed or override per call via the options.`,
    `export const createTestCtx = (options?: CreateTestPylonCtxOptions): ServerHttpContext =>`,
    `  createTestPylonCtx(options) as ServerHttpContext;`,
    ``,
  ];

  return lines.join("\n");
};
