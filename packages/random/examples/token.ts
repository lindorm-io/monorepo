import { randomToken } from "../utils";

console.log("random token", {
  16: randomToken(16),
  32: randomToken(32),
  64: randomToken(64),
  128: randomToken(128),
});
