import { LindormError, LindormErrorOptions } from "./LindormError";

enum Status {
  InternalServerError = 500,
  NotImplemented = 501,
  BadGateway = 502,
  ServiceUnavailable = 503,
  GatewayTimeout = 504,
  HttpVersionNotSupported = 505,
  VariantAlsoNegotiates = 506,
  InsufficientStorage = 507,
  LoopDetected = 508,
  NotExtended = 510,
  NetworkAuthenticationRequired = 511,
  NetworkConnectTimeoutError = 599,
}

const TITLE: Record<Status, string> = {
  [Status.InternalServerError]: "Internal Server Error",
  [Status.NotImplemented]: "Not Implemented",
  [Status.BadGateway]: "Bad Gateway",
  [Status.ServiceUnavailable]: "Service Unavailable",
  [Status.GatewayTimeout]: "Gateway Timeout",
  [Status.HttpVersionNotSupported]: "HTTP Version Not Supported",
  [Status.VariantAlsoNegotiates]: "Variant Also Negotiates",
  [Status.InsufficientStorage]: "Insufficient Storage",
  [Status.LoopDetected]: "Loop Detected",
  [Status.NotExtended]: "Not Extended",
  [Status.NetworkAuthenticationRequired]: "Network Authentication Required",
  [Status.NetworkConnectTimeoutError]: "Network Connect Timeout Error",
} as const;

type Options = Omit<LindormErrorOptions, "status"> & { status?: Status };

export class ServerError extends LindormError {
  public constructor(message: string, options: Options = {}) {
    const status: Status = options.status ?? Status.InternalServerError;

    super(message, {
      ...options,
      status,
      title: options?.title || TITLE[status] || "Server Error",
    });
  }

  public static get Status(): typeof Status {
    return Status;
  }
}
