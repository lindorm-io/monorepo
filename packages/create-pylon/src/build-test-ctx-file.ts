import type { Answers } from "./types.js";

export const buildTestCtxFile = (_answers: Answers): string => {
  const lines: Array<string> = [
    `import {`,
    `  createTestPylonCtx,`,
    `  type CreateTestPylonCtxOptions,`,
    `} from "@lindorm/pylon/mocks/vitest";`,
    `import { join } from "path";`,
    `import type { ServerHttpContext } from "../types/context.js";`,
    ``,
    `// The project's entity directory — resolved as a path the same way the`,
    `// ProteusSource registers entities (see src/proteus/source.ts), so entities`,
    `// added to the folder are picked up automatically, no list to maintain.`,
    `const ENTITY_DIRS = [join(import.meta.dirname, "..", "proteus", "entities")];`,
    ``,
    `// Assembles a working ServerHttpContext for tests: mocked infrastructure,`,
    `// but ctx.db / ctx.kv backed by a real in-memory Proteus source so`,
    `// repository round-trips genuinely work.`,
    `export const createTestCtx = (options?: CreateTestPylonCtxOptions) =>`,
    `  createTestPylonCtx({`,
    `    ...options,`,
    `    entities: [...ENTITY_DIRS, ...(options?.entities ?? [])],`,
    `  }) as Promise<ServerHttpContext>;`,
    ``,
  ];

  return lines.join("\n");
};
