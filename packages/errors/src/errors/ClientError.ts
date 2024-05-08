import { LindormError, LindormErrorOptions } from "./LindormError";

enum Status {
  BadRequest = 400,
  Unauthorized = 401,
  PaymentRequired = 402,
  Forbidden = 403,
  NotFound = 404,
  MethodNotAllowed = 405,
  NotAcceptable = 406,
  ProxyAuthenticationRequired = 407,
  RequestTimeout = 408,
  Conflict = 409,
  Gone = 410,
  LengthRequired = 411,
  PreconditionFailed = 412,
  PayloadTooLarge = 413,
  RequestUriTooLong = 414,
  UnsupportedMediaType = 415,
  RequestedRangeNotSatisfiable = 416,
  ExpectationFailed = 417,
  ImATeapot = 418,
  MisdirectedRequest = 421,
  UnprocessableEntity = 422,
  Locked = 423,
  FailedDependency = 424,
  UpgradeRequired = 426,
  PreconditionRequired = 428,
  TooManyRequests = 429,
  RequestHeaderFieldsTooLarge = 431,
  ConnectionClosedWithoutResponse = 444,
  UnavailableForLegalReasons = 451,
  ClientClosedRequest = 499,
}

const TITLE: Record<Status, string> = {
  [Status.BadRequest]: "Bad Request",
  [Status.Unauthorized]: "Unauthorized",
  [Status.PaymentRequired]: "Payment Required",
  [Status.Forbidden]: "Forbidden",
  [Status.NotFound]: "Not Found",
  [Status.MethodNotAllowed]: "Method Not Allowed",
  [Status.NotAcceptable]: "Not Acceptable",
  [Status.ProxyAuthenticationRequired]: "Proxy Authentication Required",
  [Status.RequestTimeout]: "Request Timeout",
  [Status.Conflict]: "Conflict",
  [Status.Gone]: "Gone",
  [Status.LengthRequired]: "Length Required",
  [Status.PreconditionFailed]: "Precondition Failed",
  [Status.PayloadTooLarge]: "Payload Too Large",
  [Status.RequestUriTooLong]: "Request-URI Too Long",
  [Status.UnsupportedMediaType]: "Unsupported Media Type",
  [Status.RequestedRangeNotSatisfiable]: "Requested Range Not Satisfiable",
  [Status.ExpectationFailed]: "Expectation Failed",
  [Status.ImATeapot]: "I'm a teapot",
  [Status.MisdirectedRequest]: "Misdirected Request",
  [Status.UnprocessableEntity]: "Unprocessable Entity",
  [Status.Locked]: "Locked",
  [Status.FailedDependency]: "Failed Dependency",
  [Status.UpgradeRequired]: "Upgrade Required",
  [Status.PreconditionRequired]: "Precondition Required",
  [Status.TooManyRequests]: "Too Many Requests",
  [Status.RequestHeaderFieldsTooLarge]: "Request Header Fields Too Large",
  [Status.ConnectionClosedWithoutResponse]: "Connection Closed Without Response",
  [Status.UnavailableForLegalReasons]: "Unavailable For Legal Reasons",
  [Status.ClientClosedRequest]: "Client Closed Request",
} as const;

type Options = Omit<LindormErrorOptions, "status"> & { status?: Status };

export class ClientError extends LindormError {
  public constructor(message: string, options: Options = {}) {
    const status = options.status ?? Status.BadRequest;

    super(message, {
      ...options,
      status,
      title: options?.title || TITLE[status] || "Client Error",
    });
  }

  public static get Status(): typeof Status {
    return Status;
  }
}
