import type { IncomingMessage, ServerResponse } from "http";
import type { Http2ServerRequest, Http2ServerResponse } from "http2";

export type HttpCallback = (
  req: IncomingMessage | Http2ServerRequest,
  res: ServerResponse | Http2ServerResponse,
) => Promise<void>;
