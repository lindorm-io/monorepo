import { IAegis, SignatureKit } from "@lindorm/aegis";
import { IAmphora } from "@lindorm/amphora";
import { ClientError } from "@lindorm/errors";
import { isString } from "@lindorm/is";
import { Dict } from "@lindorm/types";
import { safelyParse } from "@lindorm/utils";
import {
  PylonCookieConfig,
  PylonGetCookie,
  PylonHttpContext,
  PylonSetCookie,
} from "../../types";
import { parseCookieHeader, ParsedCookie } from "../../utils/private";
import { PylonCookie } from "./PylonCookie";

export class PylonCookieKit {
  private readonly aegis: IAegis;
  private readonly amphora: IAmphora;
  private readonly cache: Dict<any>;
  private readonly config: PylonCookieConfig;
  private readonly incoming: Array<ParsedCookie>;

  private outgoing: Array<PylonCookie>;

  public constructor(ctx: PylonHttpContext, config: PylonCookieConfig = {}) {
    this.aegis = ctx.aegis;
    this.amphora = ctx.amphora;
    this.cache = {};
    this.config = config;

    this.incoming = parseCookieHeader(ctx.get("cookie"));
    this.outgoing = [];
  }

  // public

  public async set<T = any>(
    name: string,
    value: T,
    options: PylonSetCookie,
  ): Promise<void> {
    const config = { ...this.config, ...options };

    if (!value) {
      throw new ClientError("Invalid cookie value", {
        code: "invalid_cookie_value",
        debug: { name, value, options },
      });
    }

    let final: string = isString(value) ? value : JSON.stringify(value);

    if (config.encrypted) {
      final = (await this.aegis.jwe.encrypt(final)).token;
    }

    if (config.encoding) {
      final = Buffer.from(final).toString(config.encoding);
    }

    this.removeExisting(name);

    this.outgoing.push(new PylonCookie(name, final, config));

    if (config.signed) {
      const signature = await this.sign(final);
      await this.verify(name, final, signature);

      this.outgoing.push(new PylonCookie(`${name}.sig`, signature, config));
    }
  }

  public async get<T = any>(name: string, options: PylonGetCookie): Promise<T | null> {
    if (this.cache[name]) return this.cache[name];

    const cookie = this.incoming.find((cookie) => cookie.name === name);

    if (!cookie) return null;

    const config = { ...this.config, ...options };

    if (config.signed) {
      await this.verify(name, cookie.value, cookie.signature);
    }

    if (config.encoding) {
      cookie.value = Buffer.from(cookie.value, config.encoding).toString();
    }

    if (config.encrypted) {
      cookie.value = (await this.aegis.jwe.decrypt(cookie.value)).payload;
    }

    this.cache[name] = safelyParse(cookie.value);

    return this.cache[name];
  }

  public del(name: string): void {
    this.removeExisting(name);

    this.outgoing.push(new PylonCookie(name, null, { expiry: new Date(0) }));
  }

  public toHeader(): Array<string> {
    return this.outgoing.map((cookie) => cookie.toHeader());
  }

  // private

  private removeExisting(name: string): void {
    this.outgoing = this.outgoing.filter(
      (cookie) => cookie.name !== name && cookie.name !== `${name}.sig`,
    );
  }

  private async sign(value: string): Promise<string> {
    const kryptos = await this.amphora.find({
      isExternal: false,
      operations: ["sign"],
      use: "sig",
    });

    return new SignatureKit({ kryptos }).sign(value);
  }

  private async verify(
    name: string,
    value: string,
    signature: string | null,
  ): Promise<void> {
    if (!signature) {
      throw new ClientError("Missing cookie signature", {
        code: "missing_signature",
        debug: { name, value, signature },
      });
    }

    const array = await this.amphora.filter({
      isExternal: false,
      operations: ["verify"],
      use: "sig",
    });

    for (const kryptos of array) {
      if (new SignatureKit({ kryptos }).verify(value, signature)) return;
    }

    throw new ClientError("Invalid cookie signature", {
      code: "invalid_signature",
      debug: { name, value, signature },
    });
  }
}
