import { ClientError, ServerError } from "@lindorm/errors";
import type { Dict } from "@lindorm/types";

// Every upload rejection is a client-safe ClientError with a
// `urn:lindorm:pylon:error:<code>` type. `data` only ever holds
// client-supplied or non-sensitive values (the offending extension, mime type,
// size limit, filename); absolute disk paths live in `debug` (server logs
// only), matching the static feature's discipline.

export const uploadFilesMissing = (): ClientError =>
  new ClientError("No uploaded files found on the request", {
    status: ClientError.Status.BadRequest,
    code: "upload_files_missing",
    type: "urn:lindorm:pylon:error:upload_files_missing",
    title: "Upload Files Missing",
    details:
      "The request contained no files. Enable multipart parsing for this route with `parseBody: { multipart: true, formidable: true }` and send the files as multipart form-data.",
  });

export const uploadTooManyFiles = (data: {
  count: number;
  maxFiles: number;
}): ClientError =>
  new ClientError("Too many files in a single upload request", {
    status: ClientError.Status.BadRequest,
    code: "upload_too_many_files",
    type: "urn:lindorm:pylon:error:upload_too_many_files",
    title: "Upload Too Many Files",
    details: "The request exceeded the maximum number of files allowed per upload.",
    data,
  });

export const uploadSingleFileRequired = (data: { count: number }): ClientError =>
  new ClientError("A PUT upload must contain exactly one file", {
    status: ClientError.Status.BadRequest,
    code: "upload_single_file_required",
    type: "urn:lindorm:pylon:error:upload_single_file_required",
    title: "Upload Single File Required",
    details: "A PUT upload targets one exact path and must carry exactly one file.",
    data,
  });

export const uploadTargetRequired = (): ClientError =>
  new ClientError("A PUT upload requires a target filename in the path", {
    status: ClientError.Status.BadRequest,
    code: "upload_target_required",
    type: "urn:lindorm:pylon:error:upload_target_required",
    title: "Upload Target Required",
    details:
      "A PUT upload must address an exact target filename as the final path segment.",
  });

export const uploadInvalidFilename = (data: { filename: string }): ClientError =>
  new ClientError("The target filename is not a valid single path segment", {
    status: ClientError.Status.BadRequest,
    code: "upload_invalid_filename",
    type: "urn:lindorm:pylon:error:upload_invalid_filename",
    title: "Upload Invalid Filename",
    details:
      "The filename must be a single path segment without separators; dotfiles and empty names are rejected.",
    data,
  });

export const uploadInvalidPath = (debug?: Dict): ClientError =>
  new ClientError("The upload target path is invalid", {
    status: ClientError.Status.BadRequest,
    code: "upload_invalid_path",
    type: "urn:lindorm:pylon:error:upload_invalid_path",
    title: "Upload Invalid Path",
    details:
      "The upload target path is invalid; it must stay within the mount and use no `.`, `..`, empty, or dot-prefixed segments.",
    debug,
  });

export const uploadInvalidExtension = (data: {
  extension: string;
  allowed: Array<string>;
}): ClientError =>
  new ClientError("The uploaded file extension is not allowed", {
    status: ClientError.Status.BadRequest,
    code: "upload_invalid_extension",
    type: "urn:lindorm:pylon:error:upload_invalid_extension",
    title: "Upload Invalid Extension",
    details: "The uploaded file extension is not in the mount's allowlist.",
    data,
  });

export const uploadInvalidMimeType = (data: {
  mimeType: string | null;
  allowed: Array<string>;
}): ClientError =>
  new ClientError("The uploaded file mime type is not allowed", {
    status: ClientError.Status.BadRequest,
    code: "upload_invalid_mime_type",
    type: "urn:lindorm:pylon:error:upload_invalid_mime_type",
    title: "Upload Invalid Mime Type",
    details: "The uploaded file mime type is not in the mount's allowlist.",
    data,
  });

export const uploadFileTooLarge = (data: {
  size: number;
  maxSize: number;
}): ClientError =>
  new ClientError("The uploaded file exceeds the maximum size", {
    status: ClientError.Status.BadRequest,
    code: "upload_file_too_large",
    type: "urn:lindorm:pylon:error:upload_file_too_large",
    title: "Upload File Too Large",
    details: "The uploaded file exceeds the mount's maximum size per file.",
    data,
  });

export const uploadConflict = (data: { name: string }): ClientError =>
  new ClientError("A file already exists at the upload target", {
    status: ClientError.Status.Conflict,
    code: "upload_conflict",
    type: "urn:lindorm:pylon:error:upload_conflict",
    title: "Upload Conflict",
    details:
      "A file already exists at the target path; set `overwrite: true` on the mount to replace it.",
    data,
  });

export const uploadWriteFailed = (error: unknown, debug?: Dict): ServerError =>
  new ServerError("Unable to write the uploaded file", {
    code: "upload_write_failed",
    type: "urn:lindorm:pylon:error:upload_write_failed",
    title: "Upload Write Failed",
    details: "The uploaded file could not be written to disk.",
    error: error as Error,
    debug,
  });
