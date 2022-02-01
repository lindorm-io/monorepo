import { KoaContext } from "../types";

export const deleteCookie =
  (ctx: KoaContext) =>
  (name: string): void => {
    const { cookies } = ctx;

    cookies.set(name);
  };
