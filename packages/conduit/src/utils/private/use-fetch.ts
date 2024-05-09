import { Dict, Header } from "@lindorm/types";
import { ConduitError } from "../../errors";
import { ConduitResponse } from "../../types";

const parseResponseData = async (response: Response): Promise<any> => {
  const contentType = response.headers.get("content-type");

  try {
    if (contentType?.includes("application/json")) {
      return await response.json();
    }

    if (contentType?.includes("text/plain")) {
      return await response.text();
    }
  } catch (_) {
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

export const _useFetch = async (
  input: URL | string,
  init: RequestInit,
  config?: any,
): Promise<ConduitResponse> => {
  const response = await fetch(input, init);

  const data = await parseResponseData(response);
  const headers = parseResponseHeaders(response);

  if (!response.ok) {
    throw new ConduitError(response.statusText, {
      status: response.status,
      config,
      request: {
        ...init,
        url: input.toString(),
      },
      response: {
        data,
        headers,
        status: response.status,
        statusText: response.statusText,
      },
    });
  }

  return {
    data,
    headers,
    status: response.status,
    statusText: response.statusText,
  };
};
