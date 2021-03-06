import { Axios, AxiosOptions } from "@lindorm-io/axios";
import { JWK, KeyPair } from "@lindorm-io/key-pair";
import { ServerError } from "@lindorm-io/errors";
import { flatten } from "lodash";

interface Options extends AxiosOptions {
  currentKeys?: Array<KeyPair>;
  host: string;
  path?: string;
}

interface Response {
  keys: Array<JWK>;
}

export const getKeysFromJwks = async (options: Options): Promise<Array<KeyPair>> => {
  const {
    currentKeys = [],
    host,
    name = "jwks",
    path = "/.well-known/jwks.json",
    port,
    ...rest
  } = options;

  const axios = new Axios({ host, name, port, ...rest });

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

  return flatten([currentKeys, keys]);
};
