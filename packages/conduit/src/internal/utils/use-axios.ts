import type { RawAxiosRequestConfig } from "axios";
import axios from "axios";
import type { ConduitResponse } from "../../types/index.js";

export const useAxios = async (
  config: RawAxiosRequestConfig,
): Promise<ConduitResponse> => {
  const response = await axios.request({ ...config, adapter: config.adapter ?? "http" });

  // Buffer normalisation is Node-only; in the browser (fetch adapter) the
  // native ArrayBuffer is returned as-is.
  if (config.responseType === "arraybuffer" && typeof Buffer !== "undefined") {
    response.data = Buffer.from(response.data);
  }

  return {
    cached: null,
    data: response.data,
    headers: response.headers as any,
    status: response.status,
    statusText: response.statusText,
  };
};
