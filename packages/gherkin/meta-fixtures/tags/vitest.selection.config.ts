import { createChildConfig } from "../child-config.js";

// The SAME fixture tree under transform-time selection: scenarios whose
// pickles carry @slow never become tests (vs --tagsFilter, which skips).
const config = createChildConfig({
  features: ["features/**/*.feature"],
  steps: ["steps/**/*.steps.ts"],
  tags: "not @slow",
});

config.test = {
  ...config.test,
  include: ["features/**/*.feature", "checks/**/*.test.ts"],
  tags: [{ name: "operator" }, { name: "operator-only" }],
};

export default config;
