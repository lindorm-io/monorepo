import { createChildConfig } from "../child-config.js";

export default createChildConfig({
  features: ["features/**/*.feature"],
  steps: ["steps/**/*.steps.ts"],
});
