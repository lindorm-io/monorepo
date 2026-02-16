import base from "../../jest.config.base.mjs";
import packageJson from "./package.json" with { type: "json" };

export default {
  ...base,
  displayName: `${packageJson.name}/interop`,
  roots: ["<rootDir>/__tests__"],
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
    "^cbor$": "<rootDir>/__tests__/__mocks__/cbor.ts",
  },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        useESM: true,
        tsconfig: "tsconfig.interop.json",
      },
    ],
  },
  transformIgnorePatterns: ["node_modules/(?!(jose|@auth0/cose|cbor-x|@jfromaniello/typedmap|cbor|nofilter)/)"],
  collectCoverageFrom: [],
  coverageThreshold: {},
};
