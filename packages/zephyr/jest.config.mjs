import base from "../../jest.config.base.mjs";
import packageJson from "./package.json" with { type: "json" };

export default {
  ...base,
  displayName: packageJson.name,
  testMatch: ["**/*.test.ts", "**/*.test.tsx"],
  moduleNameMapper: {
    "^#internal/(.*)$": "<rootDir>/src/internal/$1",
  },
};
