// Polyfill Symbol.metadata for Stage 3 TC39 decorator support (Node.js < 27)
if (typeof Symbol.metadata === "undefined") {
  (Symbol as any).metadata = Symbol("Symbol.metadata");
}

import { pylon } from "./pylon/pylon";

void pylon.start();
