import { RetryCallback } from "../../types";

export const defaultRetryCallback: RetryCallback = (err, attempt, options) => {
  if (!options.maxAttempts) return false;
  if (attempt > options.maxAttempts) return false;

  switch (err.response?.status) {
    case 502:
    case 503:
    case 504:
      return true;

    default:
      return false;
  }
};
