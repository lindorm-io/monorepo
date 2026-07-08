import type { Answers } from "./types.js";

export const buildTestCtxFile = (_answers: Answers): string => {
  const lines: Array<string> = [
    `import {`,
    `  createTestPylonCtx,`,
    `  type CreateTestPylonCtxOptions,`,
    `} from "@lindorm/pylon/mocks/vitest";`,
    `import { SampleEntity } from "../proteus/entities/SampleEntity.js";`,
    `import type { ServerHttpContext } from "../types/context.js";`,
    ``,
    `// Extend this list as you add entities to the project.`,
    `const ENTITIES = [SampleEntity];`,
    ``,
    `// Assembles a working ServerHttpContext for tests: mocked infrastructure,`,
    `// but ctx.db / ctx.kv backed by a real in-memory Proteus source so`,
    `// repository round-trips genuinely work.`,
    `export const createTestCtx = (options?: CreateTestPylonCtxOptions) =>`,
    `  createTestPylonCtx({`,
    `    ...options,`,
    `    entities: [...ENTITIES, ...(options?.entities ?? [])],`,
    `  }) as Promise<ServerHttpContext>;`,
    ``,
  ];

  return lines.join("\n");
};
