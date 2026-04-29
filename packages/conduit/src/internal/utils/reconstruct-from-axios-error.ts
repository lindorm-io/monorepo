import { errorRegistry, type LindormError, NetworkError } from "@lindorm/errors";
import type { AxiosError } from "axios";
import { isPylonError } from "./is-pylon-error.js";

export const reconstructFromAxiosError = (err: AxiosError): LindormError => {
  const config = {
    adapter: err.config?.adapter,
    data: err.config?.data,
    headers: { ...(err.config?.headers ?? {}) },
    maxBodyLength: err.config?.maxBodyLength,
    maxContentLength: err.config?.maxContentLength,
    method: err.config?.method,
    timeout: err.config?.timeout,
    url: err.config?.url,
    xsrfCookieName: err.config?.xsrfCookieName,
    xsrfHeaderName: err.config?.xsrfHeaderName,
  };

  const request = {
    closed: Boolean(err.request?._closed),
    contentLength: err.request?.contentLength,
    destroyed: Boolean(err.request?.destroyed),
    ended: Boolean(err.request?._ended),
    finished: Boolean(err.request?.finished),
    hasBody: Boolean(err.request?._hasBody),
    header: err.request?.header,
    headerSent: Boolean(err.request?._headerSent),
    host: err.request?.host,
    keepAliveTimeout: err.request?._keepAliveTimeout,
    method: err.request?.method,
    path: err.request?.path,
    protocol: err.request?.protocol,
  };

  const response = {
    aborted: Boolean(err.request?.res?.aborted),
    complete: Boolean(err.request?.res?.complete),
    consuming: Boolean(err.request?.res?._consuming),
    data: err.response?.data,
    dumped: Boolean(err.request?.res?._dumped),
    headers: err.response?.headers,
    httpVersion: err.request?.res?.httpVersion,
    httpVersionMajor: err.request?.res?.httpVersionMajor,
    httpVersionMinor: err.request?.res?.httpVersionMinor,
    method: err.request?.res?.method,
    responseUrl: err.request?.res?.responseUrl,
    status: err.response?.status,
    statusText: err.response?.statusText,
    upgrade: Boolean(err.request?.res?.upgrade),
    url: err.request?.res?.url,
  };

  const status = err.status ?? err.response?.status ?? err.request?.response?.status;
  const pylon = isPylonError(response.data) ? response.data.error : undefined;
  const debug = { transport: { config, request, response } };

  if (typeof status !== "number" || status <= 0) {
    return new NetworkError(pylon?.message ?? err.message, {
      code: pylon?.code ?? err.code,
      data: pylon?.data,
      debug,
      id: pylon?.id,
      support: pylon?.support,
      title: pylon?.title,
    });
  }

  return errorRegistry.reconstruct({
    code: pylon?.code ?? err.code,
    data: pylon?.data,
    debug,
    id: pylon?.id,
    message: pylon?.message ?? err.message,
    name: pylon?.name,
    status,
    support: pylon?.support,
    title: pylon?.title,
  });
};
