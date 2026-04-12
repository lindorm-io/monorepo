import { ChangeCase, changeKeys } from "@lindorm/case";
import { isArray, isObject } from "@lindorm/is";
import { ZephyrMiddleware } from "../types/context";

export const zephyrChangeIncomingDataMiddleware = (
  mode: ChangeCase = "camel",
): ZephyrMiddleware =>
  async function zephyrChangeIncomingDataMiddleware(ctx, next) {
    await next();

    const { data } = ctx.incoming;

    if (isObject(data) || isArray(data)) {
      ctx.incoming.data = changeKeys(data, mode);
    }
  };
