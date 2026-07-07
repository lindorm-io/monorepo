import { join } from "path";
import { useStatic } from "../../middleware/http/use-static.js";
import { useUpload } from "../../middleware/http/use-upload.js";

const root = join(__dirname, "..", "upload-assets");

// One file = one mount kind: a STATIC mount and an UPLOAD mount may not share a
// file. The scanner must reject this from the STATIC side.
export const STATIC = useStatic({ root });
export const UPLOAD = useUpload({ root });
