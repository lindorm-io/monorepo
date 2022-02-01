import { HttpStatusError } from "./HttpStatusError";
import { LindormErrorOptions } from "./LindormError";
import { ClientErrorStatus } from "../enum";

interface Options extends LindormErrorOptions {
  statusCode?: number;
}

export class ClientError extends HttpStatusError {
  public constructor(message: string, options?: Options) {
    super(message, { ...(options || {}), statusCode: options?.statusCode || 400 });
  }

  public static get StatusCode(): typeof ClientErrorStatus {
    return ClientErrorStatus;
  }
}
