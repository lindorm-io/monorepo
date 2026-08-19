import { createBaseConfigChildConfig } from "./child-config.js";

// Unit mode: *.integration.feature and *.weekly.feature are lane-excluded.
export default createBaseConfigChildConfig("unit");
