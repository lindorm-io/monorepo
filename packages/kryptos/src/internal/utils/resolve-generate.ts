import type { KryptosGenerate } from "../types/generate.js";

// The `dir` algorithm sizes its oct key from the CONTENT ENCRYPTION, so the
// documented `encryption` default has to be resolved BEFORE the key is
// generated. Resolving it while assembling the Kryptos is too late: it made
// `generate.enc.oct({ algorithm: "dir" })` throw "Unsupported size" instead of
// minting a 32-byte A256GCM key. `sig` keys carry no content encryption.
export const resolveGenerate = (generate: KryptosGenerate): KryptosGenerate => ({
  ...generate,
  encryption: generate.use === "enc" ? (generate.encryption ?? "A256GCM") : null,
});
