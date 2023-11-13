import {
  Axios,
  AxiosOptions,
  TransformMode,
  axiosRequestLoggerMiddleware,
  axiosTransformRequestBodyMiddleware,
  axiosTransformRequestQueryMiddleware,
  axiosTransformResponseDataMiddleware,
} from "@lindorm-io/axios";
import { Logger } from "@lindorm-io/core-logger";
import { ServerError } from "@lindorm-io/errors";
import { JWK, KeyPair } from "@lindorm-io/key-pair";

type Options = AxiosOptions &
  Required<Pick<AxiosOptions, "alias" | "host">> & {
    currentKeys?: Array<KeyPair>;
    path?: string;
  };

interface Response {
  keys: Array<JWK>;
}

export const getKeysFromJwks = async (
  options: Options,
  logger: Logger,
): Promise<Array<KeyPair>> => {
  const {
    host,
    port,
    alias,
    currentKeys = [],
    middleware = [],
    path = "/.well-known/jwks.json",
    ...rest
  } = options;

  const axios = new Axios({
    alias,
    host,
    port,
    middleware: [
      ...middleware,
      axiosTransformRequestBodyMiddleware(TransformMode.SNAKE),
      axiosTransformRequestQueryMiddleware(TransformMode.SNAKE),
      axiosTransformResponseDataMiddleware(TransformMode.CAMEL),
      axiosRequestLoggerMiddleware(logger),
    ],
    ...rest,
  });

  const { data } = await axios.get<Response>(path);

  if (!data?.keys?.length) {
    throw new ServerError("Unable to find JWKS on path", {
      debug: { host, path, port },
    });
  }

  const keys: Array<KeyPair> = [];

  for (const key of data.keys) {
    keys.push(KeyPair.fromJWK(key));
  }

  return [currentKeys, keys].flat();
};
