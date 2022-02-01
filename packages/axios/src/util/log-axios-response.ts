import { AxiosResponse as Response } from "axios";
import { LogOptions } from "../types";

interface Options extends LogOptions {
  response: Response;
}

export const logAxiosResponse = ({ logger, name, time, response }: Options): void => {
  logger.info(`${name || "axios"} response`, {
    config: {
      auth: response?.config?.auth,
      host: response?.request?.host,
      method: response?.request?.method,
      path: response?.request?.path,
      protocol: response?.request?.protocol,
      timeout: response?.config?.timeout,
      url: response?.config?.url,
    },
    request: {
      data: response?.config?.data,
      headers: response?.config?.headers,
      params: response?.config?.params,
    },
    response: {
      data: response?.data || {},
      headers: response?.headers || {},
      status: response?.status,
      statusText: response?.statusText,
    },
    time,
  });
};
