import type { PylonHttpContext } from "../../types/index.js";

export const noopHandler = async (ctx: PylonHttpContext): Promise<void> => {
  ctx.body = undefined;
  ctx.status = 204;
};
