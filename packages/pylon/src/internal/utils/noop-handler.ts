import { PylonHttpContext } from "../../types";

export const noopHandler = async (ctx: PylonHttpContext): Promise<void> => {
  ctx.body = undefined;
  ctx.status = 204;
};
