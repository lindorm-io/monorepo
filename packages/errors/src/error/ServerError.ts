import { SERVER_ERROR_TITLE } from "../constants";
import { ServerErrorStatus } from "../enum";
import { HttpStatusError } from "./HttpStatusError";
import { LindormErrorOptions } from "./LindormError";

interface Options extends LindormErrorOptions {
  statusCode?: ServerErrorStatus;
}

export class ServerError extends HttpStatusError {
  public constructor(message: string, options?: Options) {
    const statusCode = options?.statusCode || ServerErrorStatus.INTERNAL_SERVER_ERROR;
    const title = options?.title || SERVER_ERROR_TITLE[statusCode];

    super(message, { ...options, statusCode, title });
  }

  public static get StatusCode(): typeof ServerErrorStatus {
    return ServerErrorStatus;
  }
}
