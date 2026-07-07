import { ClientError } from "@lindorm/errors";
import type { Dict } from "@lindorm/types";

// Every static miss — traversal attempt, ENOENT, a directory when listing is
// off, a non-regular file — resolves to the exact same client-visible error so
// the response never reveals what does or does not exist on disk. The offending
// path lives in `debug` (server logs only), never in `data`.
export const staticNotFound = (debug?: Dict): ClientError =>
  new ClientError("Static file not found", {
    status: ClientError.Status.NotFound,
    code: "static_file_not_found",
    type: "urn:lindorm:pylon:error:static_file_not_found",
    title: "Static File Not Found",
    details: "The requested static file does not exist or cannot be served.",
    debug,
  });
