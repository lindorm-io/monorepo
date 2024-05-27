import { ServerError } from "@lindorm/errors";
import { createReadStream } from "fs";
import { basename } from "path";
import {
  PylonHandlerFile,
  PylonHandlerFileDownloadOptions,
  PylonHandlerStream,
  PylonHttpContext,
} from "../../types";
import { fileExists, fileStat, fileType } from "./file";

const BROTLI = ".br";
const GZIP = ".gz";

export const getFile = async (
  ctx: PylonHttpContext,
  file: PylonHandlerFile,
): Promise<PylonHandlerStream> => {
  const options: PylonHandlerFileDownloadOptions = {
    immutable: false,
    maxAge: 0,
    ...(file.options ?? {}),
  };

  if (!file.path) {
    throw new ServerError("File path is required");
  }

  let path = file.path;
  let ext: string | undefined = undefined;

  if (ctx.acceptsEncodings("br") && (await fileExists(path + BROTLI))) {
    path += BROTLI;
    ext = BROTLI;
  } else if (ctx.acceptsEncodings("gzip") && (await fileExists(path + GZIP))) {
    path += GZIP;
    ext = GZIP;
  }

  const stats = await fileStat(path);
  const stream = createReadStream(path);

  return {
    contentLength: stats.size,
    filename: basename(path) ?? "download",
    immutable: options.immutable,
    lastModified: new Date(stats.mtime),
    maxAge: options.maxAge,
    mimeType: await fileType(path, ext),
    stream,
  };
};
