import { Axios, AxiosOptions, axiosRequestLoggerMiddleware } from "@lindorm-io/axios";
import { JWK, KeyPair } from "@lindorm-io/key-pair";
import { Logger } from "@lindorm-io/core-logger";
import { ServerError } from "@lindorm-io/errors";

type Options = AxiosOptions & {
  currentKeys?: Array<KeyPair>;
  host: string;
  logger: Logger;
  path?: string;
};

interface Response {
  keys: Array<JWK>;
}

export const getKeysFromJwks = async (options: Options): Promise<Array<KeyPair>> => {
  const {
    clientName = "jwks",
    currentKeys = [],
    host,
    logger,
    path = "/.well-known/jwks.json",
    port,
    ...rest
  } = options;

  const axios = new Axios({
    clientName,
    host,
    middleware: [axiosRequestLoggerMiddleware(logger)],
    port,
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
