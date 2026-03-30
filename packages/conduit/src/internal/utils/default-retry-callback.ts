import { RetryCallback } from "../../types";

export const defaultRetryCallback: RetryCallback = (err, attempt, options) => {
  if (!options.maxAttempts) return false;
  if (attempt > options.maxAttempts) return false;

  if (err.isNetworkError) return true;

  switch (err.status) {
    case 502:
    case 503:
    case 504:
      return true;

    default:
      return false;
  }
};
