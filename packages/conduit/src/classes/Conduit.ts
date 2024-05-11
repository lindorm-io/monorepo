import { HttpMethod } from "@lindorm/enums";
import { Logger } from "@lindorm/logger";
import { composeMiddleware } from "@lindorm/middleware";
import { RetryConfig } from "@lindorm/retry";
import { Dict } from "@lindorm/types";
import { extractSearchParams, getPlainUrl, getValidUrl } from "@lindorm/url";
import { v4 as uuid } from "uuid";
import { _CONDUIT_RESPONSE, _RETRY_CONFIG, _TIMEOUT } from "../constants/private/defaults";
import { ConduitUsing } from "../enums";
import { _axiosRequestHandler } from "../middleware/private/axios-request-handler";
import { _defaultHeaders } from "../middleware/private/default-headers";
import { _fetchRequestHandler } from "../middleware/private/fetch-request-handler";
import { _requestLogger } from "../middleware/private/request-logger";
import { _responseLogger } from "../middleware/private/response-logger";
import {
  AppContext,
  ConduitContext,
  ConduitMiddleware,
  ConduitOptions,
  ConduitResponse,
  ConfigContext,
  MethodOptions,
  RequestContext,
  RequestOptions,
  RetryCallback,
} from "../types";
import { _defaultRetryCallback } from "../utils/private/default-retry-callback";
import { _defaultValidateStatus } from "../utils/private/default-validate-status";

export class Conduit {
  private readonly baseUrl: URL | undefined;
  private readonly config: ConfigContext;
  private readonly context: AppContext;
  private readonly headers: Record<string, string>;
  private readonly logger: Logger | undefined;
  private readonly middleware: Array<ConduitMiddleware>;
  private readonly retryCallback: RetryCallback;
  private readonly retryConfig: RetryConfig;
  private readonly using: ConduitUsing;

  public constructor(options: ConduitOptions = {}) {
    this.baseUrl = options.baseUrl ? getPlainUrl(options.baseUrl) : undefined;

    this.config = {
      timeout: options.timeout ?? _TIMEOUT,
      validateStatus: _defaultValidateStatus,
      withCredentials: options.withCredentials,
      ...(options.config ?? {}),
    };

    this.context = {
      alias: options.alias ?? null,
      baseUrl: this.baseUrl?.toString() ?? null,
      environment: options.environment ?? null,
    };

    this.headers = options.headers ?? {};
    this.logger = options.logger ? options.logger.child(["Conduit"]) : undefined;
    this.middleware = options.middleware ?? [];

    this.retryCallback = options.retryCallback ?? _defaultRetryCallback;

    this.retryConfig = {
      ..._RETRY_CONFIG,
      ...(options.retryOptions ?? {}),
    };

    this.using = options.using ?? ConduitUsing.Axios;
  }

  public async delete<
    ResponseData = any,
    RequestBody = Dict,
    RequestParams = Dict,
    RequestQuery = Dict,
  >(
    pathOrUrl: URL | string,
    options?: RequestOptions<ResponseData, RequestBody, RequestParams, RequestQuery>,
  ): Promise<ConduitResponse<ResponseData>> {
    return this.composeRequest<ResponseData, RequestBody, RequestParams, RequestQuery>(
      pathOrUrl,
      HttpMethod.Delete,
      options,
    );
  }

  public async get<
    ResponseData = any,
    RequestBody = Dict,
    RequestParams = Dict,
    RequestQuery = Dict,
  >(
    pathOrUrl: URL | string,
    options?: RequestOptions<ResponseData, RequestBody, RequestParams, RequestQuery>,
  ): Promise<ConduitResponse<ResponseData>> {
    return this.composeRequest<ResponseData, RequestBody, RequestParams, RequestQuery>(
      pathOrUrl,
      HttpMethod.Get,
      options,
    );
  }

  public async head<
    ResponseData = any,
    RequestBody = Dict,
    RequestParams = Dict,
    RequestQuery = Dict,
  >(
    pathOrUrl: URL | string,
    options?: RequestOptions<ResponseData, RequestBody, RequestParams, RequestQuery>,
  ): Promise<ConduitResponse<ResponseData>> {
    return this.composeRequest<ResponseData, RequestBody, RequestParams, RequestQuery>(
      pathOrUrl,
      HttpMethod.Head,
      options,
    );
  }

  public async options<
    ResponseData = any,
    RequestBody = Dict,
    RequestParams = Dict,
    RequestQuery = Dict,
  >(
    pathOrUrl: URL | string,
    options?: RequestOptions<ResponseData, RequestBody, RequestParams, RequestQuery>,
  ): Promise<ConduitResponse<ResponseData>> {
    return this.composeRequest<ResponseData, RequestBody, RequestParams, RequestQuery>(
      pathOrUrl,
      HttpMethod.Options,
      options,
    );
  }

  public async patch<
    ResponseData = any,
    RequestBody = Dict,
    RequestParams = Dict,
    RequestQuery = Dict,
  >(
    pathOrUrl: URL | string,
    options?: RequestOptions<ResponseData, RequestBody, RequestParams, RequestQuery>,
  ): Promise<ConduitResponse<ResponseData>> {
    return this.composeRequest<ResponseData, RequestBody, RequestParams, RequestQuery>(
      pathOrUrl,
      HttpMethod.Patch,
      options,
    );
  }

  public async post<
    ResponseData = any,
    RequestBody = Dict,
    RequestParams = Dict,
    RequestQuery = Dict,
  >(
    pathOrUrl: URL | string,
    options?: RequestOptions<ResponseData, RequestBody, RequestParams, RequestQuery>,
  ): Promise<ConduitResponse<ResponseData>> {
    return this.composeRequest<ResponseData, RequestBody, RequestParams, RequestQuery>(
      pathOrUrl,
      HttpMethod.Post,
      options,
    );
  }

  public async put<
    ResponseData = any,
    RequestBody = Dict,
    RequestParams = Dict,
    RequestQuery = Dict,
  >(
    pathOrUrl: URL | string,
    options?: RequestOptions<ResponseData, RequestBody, RequestParams, RequestQuery>,
  ): Promise<ConduitResponse<ResponseData>> {
    return this.composeRequest<ResponseData, RequestBody, RequestParams, RequestQuery>(
      pathOrUrl,
      HttpMethod.Put,
      options,
    );
  }

  public async request<
    ResponseData = any,
    RequestBody = Dict,
    RequestParams = Dict,
    RequestQuery = Dict,
  >(
    options: MethodOptions & RequestOptions<ResponseData, RequestBody, RequestParams, RequestQuery>,
  ): Promise<ConduitResponse<ResponseData>> {
    const { method, path, url, ...rest } = options;
    const pathOrUrl = url ?? path;

    if (!pathOrUrl) {
      throw new Error(`Invalid request [ path: ${path} | url: ${url} ]`);
    }

    return this.composeRequest<ResponseData, RequestBody, RequestParams, RequestQuery>(
      pathOrUrl,
      method,
      rest,
    );
  }

  private async composeRequest<
    ResponseData = any,
    RequestBody = Dict,
    RequestParams = Dict,
    RequestQuery = Dict,
  >(
    pathOrUrl: URL | string,
    method: HttpMethod,
    options: RequestOptions<ResponseData, RequestBody, RequestParams, RequestQuery> = {},
  ): Promise<ConduitResponse<ResponseData>> {
    const {
      body,
      config = {},
      filename,
      form,
      headers = {},
      middleware = [],
      params = {},
      query = {},
      retryCallback = this.retryCallback,
      retryOptions = {},
      stream,
      timeout,
      using = this.using,
      withCredentials,
    } = options;

    const valid = getValidUrl(pathOrUrl, this.baseUrl);
    const searchParams = extractSearchParams<RequestQuery>(valid);
    const url = getPlainUrl(valid).toString();

    const req: RequestContext<RequestBody, RequestParams, RequestQuery> = {
      body: body as RequestBody,
      config: {
        ...this.config,
        ...config,
        method,
        timeout,
        withCredentials,
      },
      filename,
      form,
      headers: { ...this.headers, ...headers },
      metadata: {
        correlationId: uuid(),
        date: new Date(),
        requestId: uuid(),
      },
      params: params as RequestParams,
      query: { ...searchParams, ...query },
      retryCallback,
      retryConfig: { ...this.retryConfig, ...retryOptions },
      stream,
      url,
    };

    const context: ConduitContext<ResponseData, RequestBody, RequestParams, RequestQuery> = {
      app: this.context,
      logger: this.logger,
      req,
      res: _CONDUIT_RESPONSE,
    };

    const result = await composeMiddleware<
      ConduitContext<ResponseData, RequestBody, RequestParams, RequestQuery>
    >(context, [
      ...(this.logger ? [_responseLogger] : []),
      ...this.middleware,
      ...middleware,
      _defaultHeaders,
      ...(this.logger ? [_requestLogger] : []),
      ...(using === ConduitUsing.Axios ? [_axiosRequestHandler] : [_fetchRequestHandler]),
    ]);

    return result.res;
  }
}
