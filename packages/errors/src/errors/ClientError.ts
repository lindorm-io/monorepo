import { CLIENT_ERROR_TITLE } from "../constants";
import { ClientErrorStatus } from "../enums";
import { HttpStatusError } from "./HttpStatusError";
import { LindormErrorOptions } from "./LindormError";

interface Options extends LindormErrorOptions {
  statusCode?: ClientErrorStatus;
}

export class ClientError extends HttpStatusError {
  public constructor(message: string, options: Options = {}) {
    const statusCode = options?.statusCode || ClientErrorStatus.BAD_REQUEST;
    const title = options?.title || CLIENT_ERROR_TITLE[statusCode];

    super(message, { ...options, statusCode, title });
  }

  public static get StatusCode(): typeof ClientErrorStatus {
    return ClientErrorStatus;
  }
}
