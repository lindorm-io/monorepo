import { lindormId } from "@lindorm/random";
import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { link, rename, unlink } from "node:fs/promises";
import { join } from "path";
import { Transform } from "stream";
import { pipeline } from "stream/promises";

export type CopyToTempResult = {
  tempPath: string;
  hash: string | null;
};

// Stream-copy the formidable temp file into a dot-prefixed temp IN the target
// directory. Never rename from `file.filepath` directly: `os.tmpdir()` may be a
// different filesystem than the mount → EXDEV. Copying into the target dir first
// makes the final step a same-dir `rename`, which is atomic on POSIX. The dot
// prefix keeps the temp invisible to a STATIC mount serving this same directory
// (its dotfile rule), so a concurrent GET never sees a half-written file.
//
// When `computeHash` is set, the sha-256 of the CONTENT is computed in the same
// pass (single read). `@lindorm/sha` is buffer-only, so `node:crypto` streaming
// is a deliberate exception to the "prefer @lindorm/sha" rule.
export const copyToTemp = async (
  sourcePath: string,
  targetDir: string,
  computeHash: boolean,
): Promise<CopyToTempResult> => {
  const tempPath = join(
    targetDir,
    `.upload-${lindormId({ namespace: "tmp", length: 32 })}`,
  );
  const hash = computeHash ? createHash("sha256") : null;

  try {
    const read = createReadStream(sourcePath);
    // `wx`: fail if the temp somehow already exists rather than clobber it.
    const write = createWriteStream(tempPath, { flags: "wx" });

    if (hash) {
      const tap = new Transform({
        transform(chunk, _encoding, callback) {
          hash.update(chunk);
          callback(null, chunk);
        },
      });
      await pipeline(read, tap, write);
    } else {
      await pipeline(read, write);
    }
  } catch (error) {
    await discardTempFile(tempPath);
    throw error;
  }

  return { tempPath, hash: hash ? hash.digest("base64url") : null };
};

// Same-dir atomic commit into the final name. `rename` silently replaces an
// existing target, so it is only used when replacing is allowed; otherwise
// `link` fails EEXIST atomically — a check-then-rename would let a concurrent
// upload of the same name slip past the conflict check and be overwritten.
export const commitTempFile = async (
  tempPath: string,
  finalPath: string,
  overwrite: boolean,
): Promise<void> => {
  if (overwrite) {
    await rename(tempPath, finalPath);
    return;
  }

  await link(tempPath, finalPath);
  await discardTempFile(tempPath);
};

// Best-effort unlink — used both on failure cleanup and on hash dedupe discard.
export const discardTempFile = async (tempPath: string): Promise<void> => {
  try {
    await unlink(tempPath);
  } catch {
    // Already gone or never created — nothing to clean up.
  }
};
