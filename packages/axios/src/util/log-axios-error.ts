import { AxiosError } from "axios";
import { LogOptions } from "../types";

export interface Options extends LogOptions {
  error: AxiosError;
}

export const logAxiosError = ({ logger, name, time, error }: Options): void => {
  logger.error(`${name || "axios"} response with error`, {
    config: {
      auth: error?.config?.auth,
      host: error?.request?.host,
      method: error?.request?.method,
      path: error?.request?.path,
      protocol: error?.request?.protocol,
      timeout: error?.config?.timeout,
      url: error?.config?.url,
    },
    request: {
      data: error?.config?.data,
      headers: error?.config?.headers,
      params: error?.config?.params,
    },
    response: {
      data: error?.response?.data || {},
      headers: error?.response?.headers || {},
      status: error?.response?.status,
      statusText: error?.response?.statusText,
    },
    time,
  });
};
