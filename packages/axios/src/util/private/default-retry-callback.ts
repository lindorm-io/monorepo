import { RetryCallback } from "../../types";

export const defaultRetryCallback: RetryCallback = (err, attempt, options) => {
  if (!options.maximumAttempts) return false;
  if (attempt > options.maximumAttempts) return false;

  switch (err.response?.status) {
    case 500:
    case 502:
    case 503:
    case 504:
      return true;

    default:
      return false;
  }
};
