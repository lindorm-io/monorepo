import type { RawAxiosRequestConfig } from "axios";
import axios from "axios";
import { ConduitResponse } from "../../types";

export const useAxios = async (
  config: RawAxiosRequestConfig,
): Promise<ConduitResponse> => {
  const response = await axios.request({ ...config, adapter: config.adapter ?? "http" });

  if (config.responseType === "arraybuffer") {
    response.data = Buffer.from(response.data);
  }

  return {
    data: response.data,
    headers: response.headers as any,
    status: response.status,
    statusText: response.statusText,
  };
};
