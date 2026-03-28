import base from "../../jest.config.base.mjs";
import packageJson from "./package.json" with { type: "json" };

export default {
  ...base,
  displayName: packageJson.name,
  setupFilesAfterEnv: ["jest-extended", "<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
    "^#internal/(.*)$": "<rootDir>/src/internal/$1",
  },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: {
          target: "ES2022",
          lib: ["ESNext"],
          isolatedModules: true,
        },
      },
    ],
  },
};
