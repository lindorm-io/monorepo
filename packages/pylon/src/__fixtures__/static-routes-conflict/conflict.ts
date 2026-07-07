import { join } from "path";
import type { PylonHttpMiddleware } from "../../types/index.js";
import { useStatic } from "../../middleware/http/use-static.js";

const root = join(__dirname, "..", "static-assets");

// A STATIC mount must be the ONLY route export in its file. Pairing it with a
// GET handler is a configuration error the scanner must reject.
export const STATIC = useStatic({ root });

export const GET: PylonHttpMiddleware = async (ctx) => {
  ctx.status = 200;
  ctx.body = { ok: true };
};
