import { Axios } from "@lindorm-io/axios";
import { JWK } from "@lindorm-io/key-pair";
import { KeyPair } from "@lindorm-io/key-pair";
import { Logger } from "@lindorm-io/winston";
import { WebKeyHandlerError } from "../error";

interface Options {
  clientName: string;
  host: string;
  port?: number;
  logger: Logger;
}

interface AxiosResponse {
  keys: Array<JWK>;
}

export class WebKeyHandler {
  private readonly axios: Axios;
  private readonly logger: Logger;

  public constructor(options: Options) {
    this.logger = options.logger.createChildLogger(["WebKeyHandler"]);
    this.axios = new Axios({
      host: options.host,
      port: options.port,
      logger: this.logger,
      name: options.clientName,
    });
  }

  public async getKeys(): Promise<Array<KeyPair>> {
    const start = Date.now();

    const response = await this.axios.get<AxiosResponse>("/.well-known/jwks.json");
    const keys = response?.data?.keys;

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
