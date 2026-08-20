import { createBaseConfigChildConfig } from "./child-config.js";

const config = await createBaseConfigChildConfig();

// The include-overwrite ACCIDENT, reproduced deliberately: REPLACING (not
// spreading) test.include after createVitestConfig drops every feature glob.
// It still collects sanity/sanity.test.ts, so without the collection guard
// this child prints green counts with every feature silently absent —
// asserted red-and-loud in src/e2e/base-config-wiring.test.ts.
config.test = { ...config.test, include: ["sanity/**/*.test.ts"] };

export default config;
