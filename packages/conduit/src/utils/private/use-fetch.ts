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

type UseFetchOptions = {
  config?: ConfigContext;
  onDownloadProgress?: (event: { loaded: number; total?: number }) => void;
  stream?: boolean;
};

export const useFetch = async (
  input: string,
  init: RequestInit,
  options?: UseFetchOptions,
): Promise<ConduitResponse> => {
  const response = await fetch(input, init);

  if (!response.ok) {
    const data = await parseResponseData(response, options?.config);
    const headers = parseResponseHeaders(response);
    throw ConduitError.fromFetchError(
      response,
      input,
      init,
      options?.config,
      data,
      headers,
    );
  }

  if (options?.stream) {
    return {
      data: response.body,
      headers: parseResponseHeaders(response),
      status: response.status,
      statusText: response.statusText,
    };
  }

  if (options?.onDownloadProgress && response.body) {
    const reader = response.body.getReader();
    const contentLength = response.headers.get("content-length");
    const total = contentLength ? parseInt(contentLength, 10) : undefined;
    const chunks: Array<Uint8Array> = [];
    let loaded = 0;

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      loaded += value.byteLength;
      options.onDownloadProgress({ loaded, total });
    }

    const combined = new Uint8Array(loaded);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.byteLength;
    }

    const reconstructed = new Response(combined, {
      headers: response.headers,
      status: response.status,
      statusText: response.statusText,
    });

    const data = await parseResponseData(reconstructed, options?.config);
    const headers = parseResponseHeaders(response);

    return {
      data,
      headers,
      status: response.status,
      statusText: response.statusText,
    };
  }

  const data = await parseResponseData(response, options?.config);
  const headers = parseResponseHeaders(response);

  return {
    data,
    headers,
    status: response.status,
    statusText: response.statusText,
  };
};
