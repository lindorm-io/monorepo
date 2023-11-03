import { randomHex } from "../src/utils";

console.log("random hex", {
  8: randomHex(8),
  16: randomHex(16),
  32: randomHex(32),
  64: randomHex(64),
});
