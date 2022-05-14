import { KoaContext } from "../../types";

export const deleteCookie =
  (ctx: KoaContext) =>
  (name: string): void => {
    ctx.cookies.set(name);
  };
