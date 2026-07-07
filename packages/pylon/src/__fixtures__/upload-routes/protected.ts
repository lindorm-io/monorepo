import { join } from "path";
import { useUpload } from "../../middleware/http/use-upload.js";
import type { PylonHttpMiddleware } from "../../types/index.js";

const root = join(__dirname, "..", "upload-assets");

export const uploadMarker: PylonHttpMiddleware = async (ctx, next) => {
  ctx.set("X-Upload-Guard", "1");
  await next();
};

// Array form: guards run before the terminal upload middleware.
export const UPLOAD = [uploadMarker, useUpload({ root, overwrite: true })];
