import {
  Axios,
  AxiosClientProperties,
  AxiosOptions,
  TransformMode,
  axiosClientHeadersMiddleware,
  axiosTransformRequestBodyMiddleware,
  axiosTransformRequestQueryMiddleware,
} from "@lindorm-io/axios";
import { Logger } from "@lindorm-io/core-logger";
import { ServerError } from "@lindorm-io/errors";
import { ExternalJwk, WebKeySet } from "@lindorm-io/jwk";
import { createURL } from "@lindorm-io/url";

type Options = AxiosOptions &
  Required<Pick<AxiosOptions, "alias" | "host">> & {
    client?: Partial<AxiosClientProperties>;
    path?: string;
  };

type Response = {
  keys: Array<ExternalJwk>;
};

export const getKeysFromJwks = async (
  options: Options,
  logger: Logger,
): Promise<Array<WebKeySet>> => {
  const {
    client,
    host,
    port,
    alias,
    middleware = [],
    path = "/.well-known/jwks.json",
    ...rest
  } = options;

  const axios = new Axios(
    {
      alias,
      host,
      port,
      middleware: [
        ...middleware,
        ...(client ? [axiosClientHeadersMiddleware(client)] : []),
        axiosTransformRequestBodyMiddleware(TransformMode.SNAKE),
        axiosTransformRequestQueryMiddleware(TransformMode.SNAKE),
      ],
      ...rest,
    },
    logger,
  );

  const jku = createURL(path, { host, port }).toString();

  const { data } = await axios.get<Response>(path);

  if (!data?.keys?.length) {
    throw new ServerError("Unable to find JWKS on path", {
      debug: { host, path, port },
    });
  }

  const keys: Array<WebKeySet> = [];

  for (const key of data.keys) {
    keys.push(WebKeySet.fromJwk({ jku, ...key }));
  }

  return keys;
};
