import base from "../../jest.config.base.mjs";
import packageJson from "./package.json" with { type: "json" };

export default {
  ...base,
  displayName: `${packageJson.name}/smoke`,
  roots: ["<rootDir>/__smoke__"],
  collectCoverageFrom: [],
  coverageThreshold: {},
};
