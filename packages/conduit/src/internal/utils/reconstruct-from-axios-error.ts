import { errorRegistry, type LindormError, NetworkError } from "@lindorm/errors";
import { isString } from "@lindorm/is";
import type { AxiosError } from "axios";
import { isPylonError } from "./is-pylon-error.js";
import { parseForeignErrorCode } from "./parse-foreign-error-code.js";
import { parseForeignErrorMessage } from "./parse-foreign-error-message.js";
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

  // No status: nothing answered. The failure is our client's (connection refused, timed out),
  // so axios's `code` — `ECONNREFUSED`, `ETIMEDOUT` — is the one that means something here.
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

  // A pylon error is one of ours: the envelope is authoritative, `name` and all. Reconstructing
  // by name is the point — a service's own `InvalidFirstNameSchema` (a 400 like a dozen others)
  // comes back as itself and the caller catches it with `instanceof`, which a status cannot do.
  // It only resolves if the CALLER has the class registered (registration is an import side
  // effect); otherwise resolution falls back to the status, which is the correct degradation.
  if (pylon) {
    return errorRegistry.reconstruct({
      code: pylon.code,
      data: pylon.data,
      debug,
      id: pylon.id,
      message: pylon.message,
      name: pylon.name,
      status,
      support: pylon.support,
      title: pylon.title,
      type,
    });
  }

  // A foreign server answered. Cast it to the class its STATUS earns — odesli's 429 is a
  // TooManyRequestsError — but claim nothing on its behalf beyond that:
  //
  //  - `type` is `urn:http:error:<status>`. A `urn:lindorm:` type would assert the error came
  //    from a lindorm service, which it did not.
  //  - `code` and `message` are whatever the body supplied, and nothing when it supplied none.
  //  - `data` stays EMPTY. It is caller-visible, and a foreign body of unknown shape carries
  //    unknown sensitivity — it belongs in `debug.transport.response`, which is not.
  //  - `name` is not passed, so the class is resolved from the status alone.
  return errorRegistry.reconstruct({
    code: parseForeignErrorCode(err.response?.data) ?? undefined,
    debug,
    message: parseForeignErrorMessage(err.response?.data) ?? err.message,
    status,
    type: `urn:http:error:${status}`,
  });
};
