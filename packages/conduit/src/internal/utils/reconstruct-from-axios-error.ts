import { errorRegistry, type LindormError, NetworkError } from "@lindorm/errors";
import { isString } from "@lindorm/is";
import type { AxiosError } from "axios";
import { isPylonError } from "./is-pylon-error.js";
import { redactData } from "./redact-data.js";
import { redactHeaders, redactRawHeaders } from "./redact-headers.js";

// The `debug.transport` payload below is both logged (response-logger's failure branch,
// at `warn`) and carried on the error thrown to the caller — so credentials are redacted
// here, at source, rather than at each consumer.
export const reconstructFromAxiosError = (err: AxiosError): LindormError => {
  const config = {
    adapter: err.config?.adapter,
    data: redactData(err.config?.data),
    headers: redactHeaders({ ...(err.config?.headers ?? {}) }),
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
    header: redactRawHeaders(err.request?.header),
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
    data: redactData(err.response?.data),
    dumped: Boolean(err.request?.res?._dumped),
    headers: redactHeaders(err.response?.headers),
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

  // Detected on the raw body: redaction is a shallow top-level pass and never touches the
  // nested pylon `error` envelope, but the raw value keeps the type narrowing honest.
  const pylon = isPylonError(err.response?.data) ? err.response.data.error : undefined;
  const debug = { transport: { config, request, response } };

  const type =
    isString(pylon?.type) && /^urn:/i.test(pylon.type) ? pylon.type : undefined;

  if (typeof status !== "number" || status <= 0) {
    return new NetworkError(pylon?.message ?? err.message, {
      code: pylon?.code ?? err.code,
      data: pylon?.data,
      debug,
      id: pylon?.id,
      support: pylon?.support,
      title: pylon?.title,
      type,
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
    type,
  });
};
