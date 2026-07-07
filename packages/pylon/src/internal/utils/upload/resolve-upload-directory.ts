import { resolveStaticPath } from "../static/resolve-static-path.js";
import { uploadInvalidPath } from "./upload-error.js";

// Splat → absolute target directory under `root`. REUSES the static resolver so
// the decoded-splat rules stay identical (NUL, empty, `.`/`..`, dot-prefixed
// segments all rejected). On a write surface the client must learn the path was
// invalid, so the static 404 is translated into the upload 400 here.
export const resolveUploadDirectory = (
  root: string,
  splat: string | undefined,
): string => {
  try {
    return resolveStaticPath(root, splat);
  } catch {
    throw uploadInvalidPath({ root, splat });
  }
};
