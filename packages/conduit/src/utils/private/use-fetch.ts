import { isFunction } from "@lindorm/is";
import { Dict, Header } from "@lindorm/types";
import { ConduitError } from "../../errors";
import { ConduitResponse, ConfigContext } from "../../types";

const parseResponseData = async (
  response: Response,
  config?: ConfigContext,
): Promise<any> => {
  const contentType = response.headers.get("content-type");

  try {
    if (
      config?.responseType === "arraybuffer" ||
      contentType?.includes("application/octet-stream")
    ) {
      return Buffer.from(await response.arrayBuffer());
    }

    if (config?.responseType === "blob") {
      return await response.blob();
    }

    if (
      isFunction(response.formData) &&
      (contentType?.includes("multipart/form-data") ||
        config?.responseType === "formdata")
    ) {
      return await response.formData();
    }

    if (contentType?.includes("application/json")) {
      return await response.json();
    }

    if (contentType?.includes("text/plain")) {
      return await response.text();
    }
  } catch {
    return undefined;
  }

  return undefined;
};

const parseResponseHeaders = (response: Response): Dict<Header> => {
  const headers: Dict<Header> = {};

  for (const [key, value] of response.headers.entries()) {
    headers[key] = value;
  }

  return headers;
};

export const useFetch = async (
  input: string,
  init: RequestInit,
  config?: ConfigContext,
): Promise<ConduitResponse> => {
  const response = await fetch(input, init);

  const data = await parseResponseData(response, config);
  const headers = parseResponseHeaders(response);

  if (!response.ok) {
    throw ConduitError.fromFetchError(response, input, init, config, data, headers);
  }

  return {
    data,
    headers,
    status: response.status,
    statusText: response.statusText,
  };
};
