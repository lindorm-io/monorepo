import { ClientError } from "@lindorm/errors";
import { isString } from "@lindorm/is";

const VALID = [
  // UTF-8 variants
  "utf8",
  "utf-8",

  // ISO-8859-1 variants
  "iso-8859-1",
  "iso8859-1",
  "iso_8859_1",
  "latin1",
  "latin-1",

  // Windows-1252 variants
  "windows-1252",
  "windows1252",
  "win1252",
  "cp1252",

  // ASCII variants
  "ascii",
  "us-ascii",
  "usascii",
];

export const getContentEncoding = (header?: string): string | null => {
  if (!isString(header)) return null;

  const match = header.match(/charset\s*=\s*["']?([^;"' ]+)["']?/i);
  const exists = match && match[1].toLowerCase();

  if (!exists) return null;

  if (!VALID.includes(exists)) {
    throw new ClientError("Invalid content encoding", {
      code: "invalid_content_encoding",
      data: {
        encoding: exists,
        valid: VALID,
      },
      status: ClientError.Status.BadRequest,
    });
  }

  return exists;
};
