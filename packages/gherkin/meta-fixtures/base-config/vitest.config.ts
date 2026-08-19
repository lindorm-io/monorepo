import { createBaseConfigChildConfig } from "./child-config.js";

// Default mode: plain + integration features run, weekly is excluded —
// mirroring how *.test.ts cadence works.
export default createBaseConfigChildConfig();
