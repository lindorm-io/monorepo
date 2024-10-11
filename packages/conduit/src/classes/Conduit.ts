import { HttpMethod } from "@lindorm/enums";
import { ILogger } from "@lindorm/logger";
import { composeMiddleware } from "@lindorm/middleware";
import { RetryConfig } from "@lindorm/retry";
import { Dict } from "@lindorm/types";
import { extractSearchParams, getPlainUrl, getValidUrl } from "@lindorm/url";
import { v4 as uuid } from "uuid";
import { CONDUIT_RESPONSE, RETRY_CONFIG, TIMEOUT } from "../constants/private";
import { ConduitUsing } from "../enums";
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
  ConfigContext,
  MethodOptions,
  RequestContext,
  RequestOptions,
  RetryCallback,
} from "../types";
import { defaultRetryCallback, defaultValidateStatus } from "../utils/private";

export class Conduit implements IConduit {
  private readonly baseUrl: URL | undefined;
  private readonly config: ConfigContext;
  private readonly context: AppContext;
  private readonly headers: Record<string, string>;
  private readonly logger: ILogger | undefined;
  private readonly middleware: Array<ConduitMiddleware>;
  private readonly retryCallback: RetryCallback;
  private readonly retryConfig: RetryConfig;
  private readonly using: ConduitUsing;

  public constructor(options: ConduitOptions = {}) {
    this.baseUrl = options.baseUrl ? getPlainUrl(options.baseUrl) : undefined;

    this.config = {
      timeout: options.timeout ?? TIMEOUT,
      validateStatus: defaultValidateStatus,
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

    this.retryCallback = options.retryCallback ?? defaultRetryCallback;

    this.retryConfig = {
      ...RETRY_CONFIG,
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
        requestId: uuid(),
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
      ...this.middleware,
      ...middleware,
      defaultHeaders,
      ...(this.logger ? [requestLogger] : []),
      ...(using === ConduitUsing.Axios ? [axiosRequestHandler] : [fetchRequestHandler]),
    ]);

    return result.res;
  }
}
