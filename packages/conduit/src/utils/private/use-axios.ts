import type { RawAxiosRequestConfig } from "axios";
import axios from "axios";
import { ExpectedResponse } from "../../enums";
import { ConduitResponse } from "../../types";

export const useAxios = async (
  config: RawAxiosRequestConfig,
): Promise<ConduitResponse> => {
  const response = await axios.request(config);

  if (config.responseType === ExpectedResponse.ArrayBuffer) {
    response.data = Buffer.from(response.data);
  }

  return {
    data: response.data,
    headers: response.headers as any,
    status: response.status,
    statusText: response.statusText,
  };
};
