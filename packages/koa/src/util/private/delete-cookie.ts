import { DefaultLindormKoaContext } from "../../types";

export const deleteCookie = (ctx: DefaultLindormKoaContext, name: string): void => {
  ctx.cookies.set(name);
};
