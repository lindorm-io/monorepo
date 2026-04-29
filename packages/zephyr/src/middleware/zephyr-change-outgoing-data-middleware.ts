import { type ChangeCase, changeKeys } from "@lindorm/case";
import { isArray, isObject } from "@lindorm/is";
import type { ZephyrMiddleware } from "../types/context.js";

export const zephyrChangeOutgoingDataMiddleware = (
  mode: ChangeCase = "snake",
): ZephyrMiddleware =>
  async function zephyrChangeOutgoingDataMiddleware(ctx, next) {
    const { data } = ctx.outgoing;

    if (isObject(data) || isArray(data)) {
      ctx.outgoing.data = changeKeys(data, mode);
    }

    await next();
  };
