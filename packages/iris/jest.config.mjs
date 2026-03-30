import base from "../../jest.config.base.mjs";
import packageJson from "./package.json" with { type: "json" };

export default {
  ...base,
  displayName: packageJson.name,
  setupFilesAfterEnv: ["jest-extended", "<rootDir>/jest.setup.ts"],
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
