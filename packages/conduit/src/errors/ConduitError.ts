import { LindormError, LindormErrorOptions } from "@lindorm/errors";
import { Dict } from "@lindorm/types";
import { AxiosError } from "axios";
import { isPylonError } from "../utils/private";

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

  public get isClientError(): boolean {
    return this.status >= 400 && this.status < 500;
  }

  public get isServerError(): boolean {
    return this.status >= 500 && this.status < 600;
  }

  public static fromAxiosError(err: AxiosError): ConduitError {
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

    const pylon = isPylonError(response.data) ? response.data : undefined;

    return new ConduitError(pylon?.error.message ?? err.message, {
      id: pylon?.error.id,
      code: pylon?.error.code ?? err.code,
      config,
      data: pylon?.error.data,
      debug: { pylon },
      error: err.cause,
      request,
      response,
      status,
      support: pylon?.error.support,
      title: pylon?.error.title,
    });
  }

  public static fromFetchError(
    res: Response,
    input: URL | string,
    init: RequestInit,
    config: any,
    data: any,
    headers: Dict,
  ): ConduitError {
    const request = {
      ...init,
      url: input.toString(),
    };

    const response = {
      data,
      headers,
      status: res.status,
      statusText: res.statusText,
    };

    const status = res.status;

    const pylon = isPylonError(data) ? data : undefined;

    return new ConduitError(pylon?.error.message ?? res.statusText, {
      id: pylon?.error.id,
      code: pylon?.error.code,
      config,
      data: pylon?.error.data,
      debug: { pylon },
      request,
      response,
      status,
      support: pylon?.error.support,
      title: pylon?.error.title,
    });
  }
}
