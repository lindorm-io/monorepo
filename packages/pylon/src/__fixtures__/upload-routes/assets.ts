import { join } from "path";
import { useUpload } from "../../middleware/http/use-upload.js";

const root = join(__dirname, "..", "upload-assets");

export const UPLOAD = useUpload({ root, prefix: "/assets" });
