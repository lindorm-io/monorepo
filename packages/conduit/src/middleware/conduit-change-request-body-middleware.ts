import { type ChangeCase, changeKeys } from "@lindorm/case";
import { isArray, isObject } from "@lindorm/is";
import { changeFormKeys } from "../internal/utils/change-form-keys.js";
import type { ConduitMiddleware } from "../types/index.js";

export const conduitChangeRequestBodyMiddleware = (
  mode: ChangeCase = "snake",
): ConduitMiddleware =>
  async function conduitChangeRequestBodyMiddleware(ctx, next) {
    const { body, form } = ctx.req;

    if (isObject(body) || isArray(body)) {
      ctx.req.body = changeKeys(body, mode);
    }

    // A form-encoded request carries its fields on `ctx.req.form`, not
    // `ctx.req.body` — convert both so the arms stay in step.
    if (form) {
      ctx.req.form = changeFormKeys(form, mode);
    }

    await next();
  };
