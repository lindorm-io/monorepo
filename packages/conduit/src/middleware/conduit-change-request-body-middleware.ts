import { type ChangeCase, changeKeys, type KeysOptions } from "@lindorm/case";
import { isArray, isObject } from "@lindorm/is";
import { changeFormKeys } from "../internal/utils/change-form-keys.js";
import type { ConduitMiddleware } from "../types/index.js";

/**
 * `options.depth` bounds how far into the body the conversion reaches. Some
 * payloads carry a field whose inner keys belong to a foreign schema and must
 * reach the wire verbatim — RFC 9396 §2 `authorization_details` is the standing
 * example. `{ depth: 1 }` converts the top-level parameter names only.
 *
 * A form is unaffected: `FormData` is flat, so every field name sits at level 1
 * and any valid depth converts all of them.
 */
export const conduitChangeRequestBodyMiddleware = (
  mode: ChangeCase = "snake",
  options?: KeysOptions,
): ConduitMiddleware =>
  async function conduitChangeRequestBodyMiddleware(ctx, next) {
    const { body, form } = ctx.req;

    if (isObject(body) || isArray(body)) {
      ctx.req.body = changeKeys(body, mode, options);
    }

    // A form-encoded request carries its fields on `ctx.req.form`, not
    // `ctx.req.body` — convert both so the arms stay in step.
    if (form) {
      ctx.req.form = changeFormKeys(form, mode);
    }

    await next();
  };
