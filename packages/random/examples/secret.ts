import { randomSecret } from "../utils";

console.log("random secret", {
  8: randomSecret(8),
  16: randomSecret(16),
  32: randomSecret(32),
  64: randomSecret(64),
});
