import { DefaultLindormKoaContext } from "../../types";
import { Environment } from "../../enum";

export interface SetCookieOptions {
  expiry: Date | number;
  httpOnly: boolean;
  overwrite: boolean;
  sameSite: "strict" | "lax" | "none";
  secure: boolean;
  signed: boolean;
}

export const setCookie =
  (ctx: DefaultLindormKoaContext) =>
  (name: string, value: string, options: Partial<SetCookieOptions> = {}): void => {
    const {
      cookies,
      server: { environment, domain },
    } = ctx;

    const isDeployed = [Environment.PRODUCTION, Environment.STAGING].includes(environment);
    const expiry = options.expiry;
    const httpOnly = options.httpOnly || isDeployed;
    const overwrite = options.overwrite || isDeployed;
    const sameSite = options.sameSite || isDeployed ? "strict" : "none";
    const secure = options.secure || isDeployed;
    const signed = options.signed || isDeployed;

    cookies.set(name, value, {
      domain,
      ...(expiry instanceof Date ? { expires: expiry } : {}),
      ...(typeof expiry === "number" ? { maxAge: expiry } : {}),
      httpOnly,
      overwrite,
      sameSite,
      secure,
      signed,
    });
  };
