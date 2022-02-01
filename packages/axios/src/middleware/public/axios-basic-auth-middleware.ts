import { AxiosBasicCredentials } from "axios";
import { AxiosMiddleware, RequestConfig } from "../../types";

export const axiosBasicAuthMiddleware = (credentials: AxiosBasicCredentials): AxiosMiddleware => ({
  config: async (config): Promise<RequestConfig> => ({
    ...config,
    auth: credentials,
  }),
});
