import { Axios, AxiosOptions } from "@lindorm-io/axios";
import { JWK } from "@lindorm-io/key-pair";
import { KeyPair } from "@lindorm-io/key-pair";
import { ILogger } from "@lindorm-io/winston";
import { WebKeyHandlerError } from "../error";

export interface WebKeyHandlerOptions extends AxiosOptions {
  path?: string;
}

interface Response {
  keys: Array<JWK>;
}

export class WebKeyHandler {
  private readonly axios: Axios;
  private readonly logger: ILogger;
  private readonly path: string;

  public constructor(options: WebKeyHandlerOptions) {
    const { logger, path = "/.well-known/jwks.json", ...rest } = options;

    this.logger = logger.createChildLogger(["WebKeyHandler"]);
    this.axios = new Axios({
      ...rest,
      logger: this.logger,
    });
    this.path = path;
  }

  public async getKeys(): Promise<Array<KeyPair>> {
    const start = Date.now();

    const response = await this.axios.get<Response>(this.path);
    const keys = response.data?.keys;

    if (!keys || !keys.length) {
      throw new WebKeyHandlerError("No keys found on jwks endpoint", {
        debug: { response },
      });
    }

    const array: Array<KeyPair> = [];

    for (const key of keys) {
      array.push(KeyPair.fromJWK(key));
    }

    this.logger.debug("found keys on jwks endpoint", {
      result: { success: !!keys.length, amount: keys.length },
      time: Date.now() - start,
    });

    return array;
  }
}
