import { AxiosMiddleware } from "../../types";

export const axiosRetryMiddleware: AxiosMiddleware = {
  retry: async (error, options): Promise<boolean> => {
    if (!options.retry || options.retry < 1) return false;

    switch (error.statusCode) {
      case 500:
      case 502:
      case 503:
      case 504:
        return true;

      default:
        return false;
    }
  },
};
