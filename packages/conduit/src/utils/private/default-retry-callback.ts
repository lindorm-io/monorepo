import { ServerError } from "@lindorm/errors";
import { RetryCallback } from "../../types";

export const defaultRetryCallback: RetryCallback = (err, attempt, options) => {
  if (!options.maxAttempts) return false;
  if (attempt > options.maxAttempts) return false;

  switch (err.response?.status) {
    case ServerError.Status.BadGateway:
    case ServerError.Status.ServiceUnavailable:
    case ServerError.Status.GatewayTimeout:
      return true;

    default:
      return false;
  }
};
