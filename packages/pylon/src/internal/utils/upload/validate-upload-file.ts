import type { File } from "formidable";
import { extname } from "path";
import {
  uploadFileTooLarge,
  uploadInvalidExtension,
  uploadInvalidMimeType,
} from "./upload-error.js";

export type UploadValidationOptions = {
  extensions: Array<string> | null;
  mimeTypes: Array<string> | null;
  maxSize: number | null;
};

// Allowlist checks for one formidable file. `name` carries the filename whose
// extension is validated — the original filename on POST, the URL target on
// PUT. Throws the matching 400 on the first violation.
export const validateUploadFile = (
  file: File,
  options: UploadValidationOptions,
  name: string,
): void => {
  if (options.extensions) {
    const extension = extname(name).toLowerCase();
    if (!options.extensions.includes(extension)) {
      throw uploadInvalidExtension({ extension, allowed: options.extensions });
    }
  }

  if (options.mimeTypes) {
    // A missing mimetype cannot be verified against an active allowlist — reject.
    if (file.mimetype == null || !options.mimeTypes.includes(file.mimetype)) {
      throw uploadInvalidMimeType({
        mimeType: file.mimetype,
        allowed: options.mimeTypes,
      });
    }
  }

  if (options.maxSize != null && file.size > options.maxSize) {
    throw uploadFileTooLarge({ size: file.size, maxSize: options.maxSize });
  }
};
