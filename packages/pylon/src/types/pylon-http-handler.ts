import { Readable } from "stream";
import { PylonHttpContext } from "./pylon-http-context";

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

export type PylonHandlerWebhook<Data = any> = {
  event: string;
  data?: Data;
};

export type PylonHandlerResult<Body = any, Webhook = any> = {
  body?: Body;
  file?: PylonHandlerFile;
  location?: URL | string;
  redirect?: URL | string;
  status?: number;
  stream?: PylonHandlerStream;
  webhook?: PylonHandlerWebhook<Webhook>;
};

export type PylonHandlerResponse<Body = any, Webhook = any> = Promise<
  PylonHandlerResult<Body, Webhook>
>;

export type PylonHandler<
  Context extends PylonHttpContext = PylonHttpContext,
  Body = any,
  Webhook = any,
> = (ctx: Context) => PylonHandlerResponse<Body, Webhook> | Promise<void>;
