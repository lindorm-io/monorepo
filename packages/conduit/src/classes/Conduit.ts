import { ILogger } from "@lindorm/logger";
import { composeMiddleware } from "@lindorm/middleware";
import { RetryConfig } from "@lindorm/retry";
import { Dict, HttpMethod } from "@lindorm/types";
import { extractSearchParams, getPlainUrl, getValidUrl } from "@lindorm/url";
import { v4 as uuid } from "uuid";
import {
  CONDUIT_RESPONSE,
  REPLACE_URL,
  RETRY_CONFIG,
  TIMEOUT,
} from "../constants/private";
import { IConduit } from "../interfaces";
import {
  axiosRequestHandler,
  defaultHeaders,
  fetchRequestHandler,
  requestLogger,
  responseLogger,
} from "../middleware/private";
import {
  AppContext,
  ConduitContext,
  ConduitMiddleware,
  ConduitOptions,
  ConduitResponse,
  ConduitUsing,
  ConfigContext,
  MethodOptions,
  RequestContext,
  RequestOptions,
  RetryCallback,
} from "../types";
import { defaultRetryCallback, defaultValidateStatus } from "../utils/private";

export class Conduit implements IConduit {
  private readonly baseURL: URL | undefined;
  private readonly config: ConfigContext;
  private readonly context: AppContext;
  private readonly headers: Dict<string>;
  private readonly logger: ILogger | undefined;
  private readonly middleware: Array<ConduitMiddleware>;
  private readonly retryCallback: RetryCallback;
  private readonly retryConfig: RetryConfig;
  private readonly using: ConduitUsing;

  public constructor(options: ConduitOptions = {}) {
    this.baseURL = options.baseURL ? getPlainUrl(options.baseURL) : undefined;

    this.config = {
      timeout: options.timeout ?? TIMEOUT,
      validateStatus: defaultValidateStatus,
      withCredentials: options.withCredentials,
      ...(options.config ?? {}),
    };

    this.context = {
      alias: options.alias ?? null,
      baseURL: this.baseURL?.toString() ?? null,
      environment: options.environment ?? null,
    };

    this.headers = options.headers ?? {};
    this.logger = options.logger ? options.logger.child(["Conduit"]) : undefined;
    this.middleware = options.middleware ?? [];

    this.retryCallback = options.retryCallback ?? defaultRetryCallback;

    this.retryConfig = {
      ...RETRY_CONFIG,
      ...(options.retryOptions ?? {}),
    };

    this.using = options.using ?? "axios";
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
      "DELETE",
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
      "GET",
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
      "HEAD",
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
      "OPTIONS",
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
      "PATCH",
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
      "POST",
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
      "PUT",
      options,
    );
  }

  public async request<
    ResponseData = any,
    RequestBody = Dict,
    RequestParams = Dict,
    RequestQuery = Dict,
  >(
    options: MethodOptions &
      RequestOptions<ResponseData, RequestBody, RequestParams, RequestQuery>,
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
      expectedResponse,
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

    const valid = getValidUrl(pathOrUrl, this.baseURL ?? REPLACE_URL);
    const searchParams = extractSearchParams<RequestQuery>(valid);
    const url = getPlainUrl(valid).toString().replace(REPLACE_URL, "");

    const req: RequestContext<RequestBody, RequestParams, RequestQuery> = {
      body: body as RequestBody,
      config: {
        ...this.config,
        ...config,
        method,
        responseType: expectedResponse,
        timeout,
        withCredentials,
      },
      filename,
      form,
      headers: { ...this.headers, ...headers },
      metadata: {
        correlationId: uuid(),
        requestId: uuid(),
        sessionId: null,
      },
      params: params as RequestParams,
      query: { ...searchParams, ...query },
      retryCallback,
      retryConfig: { ...this.retryConfig, ...retryOptions },
      stream,
      url,
    };

    const context: ConduitContext<
      ResponseData,
      RequestBody,
      RequestParams,
      RequestQuery
    > = {
      app: this.context,
      logger: this.logger,
      req,
      res: CONDUIT_RESPONSE,
    };

    const result = await composeMiddleware<
      ConduitContext<ResponseData, RequestBody, RequestParams, RequestQuery>
    >(context, [
      ...(this.logger ? [responseLogger] : []),
      defaultHeaders,
      ...this.middleware,
      ...middleware,
      ...(this.logger ? [requestLogger] : []),
      ...(using === "axios" ? [axiosRequestHandler] : [fetchRequestHandler]),
    ]);

    return result.res;
  }
}
