import { ServerErrorStatus } from "../enum";

export const SERVER_ERROR_TITLE: Record<ServerErrorStatus, string> = {
  [ServerErrorStatus.INTERNAL_SERVER_ERROR]: "Internal Server Error",
  [ServerErrorStatus.NOT_IMPLEMENTED]: "Not Implemented",
  [ServerErrorStatus.BAD_GATEWAY]: "Bad Gateway",
  [ServerErrorStatus.SERVICE_UNAVAILABLE]: "Service Unavailable",
  [ServerErrorStatus.GATEWAY_TIMEOUT]: "Gateway Timeout",
  [ServerErrorStatus.HTTP_VERSION_NOT_SUPPORTED]: "HTTP Version Not Supported",
  [ServerErrorStatus.VARIANT_ALSO_NEGOTIATES]: "Variant Also Negotiates",
  [ServerErrorStatus.INSUFFICIENT_STORAGE]: "Insufficient Storage",
  [ServerErrorStatus.LOOP_DETECTED]: "Loop Detected",
  [ServerErrorStatus.NOT_EXTENDED]: "Not Extended",
  [ServerErrorStatus.NETWORK_AUTHENTICATION_REQUIRED]: "Network Authentication Required",
  [ServerErrorStatus.NETWORK_CONNECT_TIMEOUT_ERROR]: "Network Connect Timeout Error",
} as const;
