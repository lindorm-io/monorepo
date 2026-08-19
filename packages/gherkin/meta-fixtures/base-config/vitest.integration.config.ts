import { createBaseConfigChildConfig } from "./child-config.js";

// Integration mode: ONLY *.integration.feature files run. The plugin still
// receives the cadence-independent features list, so buildStart's coverage
// check must stay silent about the lane-excluded plain feature.
export default createBaseConfigChildConfig("integration");
