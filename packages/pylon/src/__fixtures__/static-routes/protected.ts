import { join } from "path";
import { useStatic } from "../../middleware/http/use-static.js";
import type { PylonHttpMiddleware } from "../../types/index.js";

const root = join(__dirname, "..", "static-assets");

export const protectedMarker: PylonHttpMiddleware = async (ctx, next) => {
  ctx.set("X-Static-Guard", "1");
  await next();
};

// Array form: guards run before the terminal serving middleware.
export const STATIC = [protectedMarker, useStatic({ root, visibility: "private" })];
