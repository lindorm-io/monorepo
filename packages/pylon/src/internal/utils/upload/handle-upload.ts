import { isArray, isObject } from "@lindorm/is";
import type { File, Files } from "formidable";
import { mkdir, stat } from "node:fs/promises";
import { extname, join, relative, sep } from "path";
import { posix } from "path";
import type { IPylonFileUpload } from "../../../interfaces/index.js";
import type { PylonHttpContext } from "../../../types/index.js";
import { buildUploadFilename, isValidFilenameSegment } from "./build-upload-filename.js";
import { commitTempFile, copyToTemp, discardTempFile } from "./persist-upload-file.js";
import { resolveUploadDirectory } from "./resolve-upload-directory.js";
import {
  uploadConflict,
  uploadFilesMissing,
  uploadInvalidFilename,
  uploadInvalidPath,
  uploadSingleFileRequired,
  uploadTargetRequired,
  uploadTooManyFiles,
  uploadWriteFailed,
} from "./upload-error.js";
import { validateUploadFile } from "./validate-upload-file.js";

export type ResolvedUploadOptions = {
  root: string;
  prefix: string | null;
  naming: "random" | "uuid" | "hash" | "original";
  extensions: Array<string> | null;
  mimeTypes: Array<string> | null;
  maxSize: number | null;
  maxFiles: number | null;
  overwrite: boolean;
};

type ResponseItem = {
  name: string;
  path: string;
  size: number;
  mimeType: string | null;
  originalName: string | null;
};

// formidable `Files` maps each field name to an array of files (or a single
// file); flatten every field into one list.
const flattenFiles = (files: Files | undefined): Array<File> => {
  if (!isObject(files)) return [];

  const result: Array<File> = [];
  for (const value of Object.values(files)) {
    if (isArray(value)) result.push(...(value as Array<File>));
    else if (value) result.push(value as File);
  }
  return result;
};

const toFileUpload = (name: string, file: File): IPylonFileUpload => ({
  filename: name,
  length: file.size,
  mimeType: file.mimetype,
  originalName: file.originalFilename,
  uploadDate: new Date(),
});

const buildResponsePath = (
  prefix: string | null,
  subdir: string,
  name: string,
): string =>
  prefix
    ? // A set prefix makes `path` a serving URL — keep its leading slash.
      posix.join(prefix, subdir, name)
    : // No prefix: a root-relative path, never a URL, so no leading slash.
      posix.join(subdir, name);

const toResponseItem = (
  options: ResolvedUploadOptions,
  subdir: string,
  name: string,
  file: File,
): ResponseItem => ({
  name,
  path: buildResponsePath(options.prefix, subdir, name),
  size: file.size,
  mimeType: file.mimetype,
  originalName: file.originalFilename,
});

// The subdirectory below `root` the file landed in, as a POSIX-joined string
// (empty for the mount root). Derived from the resolved dir so it always
// matches what is on disk.
const subdirOf = (root: string, targetDir: string): string =>
  relative(root, targetDir).split(sep).join("/");

const fileExists = async (path: string): Promise<boolean> => {
  try {
    await stat(path);
    return true;
  } catch (error: any) {
    if (error?.code === "ENOENT" || error?.code === "ENOTDIR") return false;
    throw uploadWriteFailed(error, { path });
  }
};

// Commit a temp file into its final name, cleaning up the temp on failure.
// A non-overwrite commit fails EEXIST when a concurrent request won the name —
// surface that as the same 409 the pre-check produces.
const commitOrCleanup = async (
  tempPath: string,
  finalPath: string,
  overwrite: boolean,
  name: string,
): Promise<void> => {
  try {
    await commitTempFile(tempPath, finalPath, overwrite);
  } catch (error: any) {
    await discardTempFile(tempPath);
    if (error?.code === "EEXIST") throw uploadConflict({ name });
    throw uploadWriteFailed(error, { finalPath });
  }
};

type NamedPlan = { kind: "named"; file: File; name: string };
type HashPlan = { kind: "hash"; file: File; extension: string };
type UploadPlan = NamedPlan | HashPlan;

const handlePostUpload = async (
  ctx: PylonHttpContext,
  options: ResolvedUploadOptions,
  files: Array<File>,
): Promise<void> => {
  if (options.maxFiles != null && files.length > options.maxFiles) {
    throw uploadTooManyFiles({ count: files.length, maxFiles: options.maxFiles });
  }

  const targetDir = resolveUploadDirectory(options.root, ctx.params.path);

  // Phase 1: validate ALL files (and resolve named strategies) before touching
  // disk, so a validation failure never leaves partial results.
  const plans: Array<UploadPlan> = [];
  for (const file of files) {
    // On POST the extension allowlist applies to the original filename.
    validateUploadFile(file, options, file.originalFilename ?? "");

    if (options.naming === "hash") {
      plans.push({
        kind: "hash",
        file,
        extension: extname(file.originalFilename ?? "").toLowerCase(),
      });
    } else {
      plans.push({
        kind: "named",
        file,
        name: buildUploadFilename(options.naming, file.originalFilename),
      });
    }
  }

  // Named strategies: a pre-existing name is a replace — forbidden unless
  // `overwrite`. Checked before mkdir and before persisting any file,
  // including duplicates WITHIN the request, so a conflict leaves no trace —
  // not even an empty directory. (`hash` handles its own idempotent dedupe
  // below; the non-overwrite commit also fails EEXIST for the
  // concurrent-request race the pre-check cannot see.)
  if (!options.overwrite) {
    const planned = new Set<string>();
    for (const plan of plans) {
      if (plan.kind !== "named") continue;
      if (planned.has(plan.name)) throw uploadConflict({ name: plan.name });
      planned.add(plan.name);

      if (await fileExists(join(targetDir, plan.name))) {
        throw uploadConflict({ name: plan.name });
      }
    }
  }

  await mkdir(targetDir, { recursive: true });

  // Phase 2: persist.
  const subdir = subdirOf(options.root, targetDir);
  const uploads: Array<IPylonFileUpload> = [];
  const items: Array<ResponseItem> = [];

  for (const plan of plans) {
    if (plan.kind === "hash") {
      const { tempPath, hash } = await copyToTemp(plan.file.filepath, targetDir, true);
      const name = `${hash}${plan.extension}`;
      const finalPath = join(targetDir, name);

      // Identical content already stored → idempotent dedupe: discard the temp,
      // report the existing entry, do NOT rewrite. An EEXIST from losing a
      // concurrent race over the same content is the same dedupe, not an error.
      if (await fileExists(finalPath)) {
        await discardTempFile(tempPath);
      } else {
        try {
          await commitTempFile(tempPath, finalPath, false);
        } catch (error: any) {
          await discardTempFile(tempPath);
          if (error?.code !== "EEXIST") throw uploadWriteFailed(error, { finalPath });
        }
      }

      uploads.push(toFileUpload(name, plan.file));
      items.push(toResponseItem(options, subdir, name, plan.file));
    } else {
      const { tempPath } = await copyToTemp(plan.file.filepath, targetDir, false);
      await commitOrCleanup(
        tempPath,
        join(targetDir, plan.name),
        options.overwrite,
        plan.name,
      );

      uploads.push(toFileUpload(plan.name, plan.file));
      items.push(toResponseItem(options, subdir, plan.name, plan.file));
    }
  }

  ctx.files = uploads;
  ctx.body = { files: items };
  ctx.status = 201;
};

const handlePutUpload = async (
  ctx: PylonHttpContext,
  options: ResolvedUploadOptions,
  files: Array<File>,
): Promise<void> => {
  if (files.length !== 1) {
    throw uploadSingleFileRequired({ count: files.length });
  }

  const [file] = files;
  const raw = ctx.params.path ?? "";

  if (raw.includes("\0")) throw uploadInvalidPath({ splat: raw });
  // Empty splat or a trailing slash = no target filename.
  if (raw === "" || raw.endsWith("/")) throw uploadTargetRequired();

  const segments = raw.split("/");
  const name = segments[segments.length - 1];
  // The target name is validated like `original` — reject dotfiles/empties.
  if (!isValidFilenameSegment(name)) throw uploadInvalidFilename({ filename: name });

  const dirSplat = segments.slice(0, -1).join("/");
  const targetDir = resolveUploadDirectory(options.root, dirSplat);

  // On PUT the extension allowlist applies to the URL target name.
  validateUploadFile(file, options, name);

  await mkdir(targetDir, { recursive: true });

  const finalPath = join(targetDir, name);
  const existed = await fileExists(finalPath);
  if (existed && !options.overwrite) throw uploadConflict({ name });

  // PUT ignores the naming strategy — the name is fixed by the URL, so never
  // hash.
  const { tempPath } = await copyToTemp(file.filepath, targetDir, false);
  await commitOrCleanup(tempPath, finalPath, options.overwrite, name);

  const subdir = subdirOf(options.root, targetDir);

  ctx.files = [toFileUpload(name, file)];
  ctx.body = { files: [toResponseItem(options, subdir, name, file)] };
  ctx.status = existed ? 200 : 201;
};

export const handleUpload = async (
  ctx: PylonHttpContext,
  options: ResolvedUploadOptions,
): Promise<void> => {
  const files = flattenFiles(ctx.request.files);
  if (!files.length) throw uploadFilesMissing();

  if (ctx.method === "PUT") {
    await handlePutUpload(ctx, options, files);
    return;
  }
  await handlePostUpload(ctx, options, files);
};
