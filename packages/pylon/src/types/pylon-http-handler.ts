import { Readable } from "stream";
import { PylonHttpContext } from "./context-http";

export type PylonHandlerFileDownloadOptions = {
  immutable?: boolean;
  maxAge?: number;
};

export type PylonHandlerFile = {
  options?: PylonHandlerFileDownloadOptions;
  path: string;
};

export type PylonHandlerStream = {
  contentLength: number;
  lastModified: Date;
  mimeType: string;
  stream: Readable;

  filename?: string;
  immutable?: boolean;
  maxAge?: number;
  originalName?: string;
};

export type PylonHandlerResult<Body = any> = {
  body?: Body;
  file?: PylonHandlerFile;
  location?: URL | string;
  redirect?: URL | string;
  status?: number;
  stream?: PylonHandlerStream;
};

export type PylonHandlerResponse<Body = any> = Promise<PylonHandlerResult<Body>>;

export type PylonHandler<
  Context extends PylonHttpContext = PylonHttpContext,
  Body = any,
> = (ctx: Context) => PylonHandlerResponse<Body> | Promise<void>;
