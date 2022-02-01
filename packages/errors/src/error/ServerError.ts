import { HttpStatusError } from "./HttpStatusError";
import { LindormErrorOptions } from "./LindormError";
import { ServerErrorStatus } from "../enum";

interface Options extends LindormErrorOptions {
  statusCode?: number;
}

export class ServerError extends HttpStatusError {
  public constructor(message: string, options?: Options) {
    super(message, { ...(options || {}), statusCode: options?.statusCode || 500 });
  }

  public static get StatusCode(): typeof ServerErrorStatus {
    return ServerErrorStatus;
  }
}
