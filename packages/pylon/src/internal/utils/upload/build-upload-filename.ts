import { randomId } from "@lindorm/random";
import { randomUUID } from "node:crypto";
import { extname } from "path";
import { uploadInvalidFilename } from "./upload-error.js";

// A valid single path segment: non-empty, no NUL, no separator, and not
// dot-prefixed (which covers `.`, `..` and dotfiles). Same rules as the splat,
// applied to a filename that must NOT be sanitized — reject, never mangle.
export const isValidFilenameSegment = (name: string): boolean =>
  name.length > 0 && !name.includes("\0") && !name.includes("/") && !name.startsWith(".");

// POST naming strategies that yield a name from the original filename alone.
// `hash` is deliberately excluded — its name is only known after the content is
// streamed to a temp file, so the caller handles it separately.
export const buildUploadFilename = (
  naming: "random" | "uuid" | "original",
  originalFilename: string | null,
): string => {
  const ext = extname(originalFilename ?? "").toLowerCase();

  switch (naming) {
    case "random":
      return `${randomId({ namespace: "f", length: 32 })}${ext}`;

    case "uuid":
      return `${randomUUID()}${ext}`;

    case "original": {
      const name = originalFilename ?? "";
      if (!isValidFilenameSegment(name)) {
        throw uploadInvalidFilename({ filename: name });
      }
      return name;
    }
  }
};
