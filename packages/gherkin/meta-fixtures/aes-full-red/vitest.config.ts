import { createChildConfig } from "../child-config.js";

// The step glob matches nothing on purpose — the M3 exit criterion's RED
// half: the full §3.1 feature with no step definitions prints 5 Undefined-step
// failures with pasteable snippets.
export default createChildConfig({
  features: ["features/**/*.feature"],
  steps: ["steps/**/*.steps.ts"],
});
