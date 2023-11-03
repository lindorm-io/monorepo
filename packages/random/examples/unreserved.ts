import { randomUnreserved } from "../utils";

console.log("random unreserved", {
  16: randomUnreserved(16),
  32: randomUnreserved(32),
  64: randomUnreserved(64),
  128: randomUnreserved(128),
});
