import { createChildConfig } from "../child-config.js";

// The step glob matches nothing on purpose — the M1 exit criterion's RED
// half: the §7 feature with no step definitions prints 4 Undefined-step
// failures with pasteable snippets.
export default createChildConfig({
  features: ["features/**/*.feature"],
  steps: ["steps/**/*.steps.ts"],
});
