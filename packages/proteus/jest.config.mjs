import base from "../../jest.config.base.mjs";
import packageJson from "./package.json" with { type: "json" };

export default {
  ...base,
  displayName: packageJson.name,
  // Polyfill Symbol.metadata for stage-3 decorator support
  setupFilesAfterEnv: ["jest-extended", "<rootDir>/jest.setup.ts"],
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: {
          // Override target to ES2022 so TypeScript emits __esDecorate helpers
          // for stage-3 decorators instead of native @ syntax (which Node.js
          // does not yet support at runtime even with experimentalDecorators: false).
          target: "ES2022",
          // Keep ESNext lib so Symbol.metadata is available as a type
          lib: ["ESNext"],
        },
      },
    ],
  },
};
