import { Axios, AxiosOptions } from "@lindorm-io/axios";
import { isUrl } from "@lindorm-io/core";
import { Logger } from "@lindorm-io/core-logger";
import { ServerError } from "@lindorm-io/errors";
import { ExternalJwk, WebKeySet } from "@lindorm-io/jwk";
import { createURL } from "@lindorm-io/url";

type Options = AxiosOptions & {
  path?: string;
};

type Response = {
  keys: Array<ExternalJwk>;
};

export const getKeysFromJwks = async (
  options: Options,
  logger: Logger,
): Promise<Array<WebKeySet>> => {
  const { path = "/.well-known/jwks.json", ...rest } = options;
  const { baseURL, host, port } = rest;

  const axios = new Axios(rest, logger);

  const jku = createURL(path, {
    baseURL: isUrl(baseURL) ? baseURL.toString() : baseURL,
    host,
    port,
  }).toString();

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
