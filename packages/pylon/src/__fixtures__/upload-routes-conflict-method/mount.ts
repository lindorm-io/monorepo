import { join } from "path";
import { useUpload } from "../../middleware/http/use-upload.js";
import type { PylonHttpMiddleware } from "../../types/index.js";

const root = join(__dirname, "..", "upload-assets");

// An UPLOAD mount must be the ONLY route export in its file. Pairing it with an
// HTTP method handler is a configuration error the scanner must reject.
export const UPLOAD = useUpload({ root });

export const GET: PylonHttpMiddleware = async (ctx) => {
  ctx.status = 200;
  ctx.body = { ok: true };
};
