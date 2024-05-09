import { LindormError, LindormErrorOptions } from "@lindorm/errors";
import { AxiosError } from "axios";

type ConduitErrorOptions = LindormErrorOptions & {
  config?: any;
  request?: any;
  response?: any;
};

export class ConduitError extends LindormError {
  public readonly config: any;
  public readonly request: any;
  public readonly response: any;

  public constructor(message: string, options: ConduitErrorOptions = {}) {
    super(message, options);
    this.config = options.config;
    this.request = options.request;
    this.response = options.response;
  }

  public static fromAxiosError(err: AxiosError): ConduitError {
    return new ConduitError(err.message, {
      code: err.code,
      status: err.status ?? err.response?.status ?? err.request?.response?.status,
      error: err.cause,
      config: {
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
      },
      request: {
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
      },
      response: {
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
      },
    });
  }
}
