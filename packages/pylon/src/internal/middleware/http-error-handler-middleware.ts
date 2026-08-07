import { ClientError, ServerError, generateSupport } from "@lindorm/errors";
import { isNumber, isString } from "@lindorm/is";
import { lindormId } from "@lindorm/random";
import { RedirectError } from "../../errors/index.js";
import type { PylonHttpMiddleware } from "../../types/index.js";
import { deriveChallenge } from "../utils/challenge/derive-challenge.js";
import { resolveErrorStatus } from "../utils/resolve-error-status.js";

// `resolveErrorStatus` answers a plain `number` — an arbitrary error's `status`
// is not a member of either enum — so the 401 it is compared against is widened
// to match rather than compared enum-to-number.
const UNAUTHORIZED: number = ClientError.Status.Unauthorized;

export const httpErrorHandlerMiddleware: PylonHttpMiddleware = async (ctx, next) => {
  try {
    await next();
  } catch (err: any) {
    try {
      const status = resolveErrorStatus(err);

      if (err instanceof RedirectError) {
        const url = new URL(err.redirect);

        if (isNumber(err.code) || (isString(err.code) && err.code.length)) {
          url.searchParams.append("error", String(err.code));
        }
        if (err.details?.length) {
          url.searchParams.append("error_description", err.details);
        }
        if (err.uri?.length) {
          url.searchParams.append("error_uri", err.uri);
        }
        if (err.support?.length) {
          url.searchParams.append("support", err.support);
        }
        if (err.state?.length) {
          url.searchParams.append("state", err.state);
        }
        if (err.issuer?.length) {
          url.searchParams.append("iss", err.issuer);
        }

        ctx.redirect(url.toString());
      } else {
        ctx.status = status;

        // RFC 9110 §11.6.1 — a 401 must advertise how to authenticate. Only 401: a 403
        // insufficient_scope challenge is a deliberate ctx.challenge() call, never derived.
        // An explicit challenge already on the response always wins.
        if (status === UNAUTHORIZED && !ctx.response?.get("WWW-Authenticate")) {
          deriveChallenge(ctx);
        }

        ctx.body = {
          __meta: {
            app: "Pylon",
            environment: ctx.state?.app?.environment,
            name: ctx.state?.app?.name,
            version: ctx.state?.app?.version,
          },
          error: {
            id: err.id ?? lindormId({ namespace: "err", length: 16 }),
            name: err.name ?? "Error",
            title: err.title ?? "Error",
            message: err.message,
            code: err.code ?? "unknown_error",
            type: err.type ?? "urn:lindorm:error:unknown_error",
            support: err.support ?? generateSupport(),
            data: err.data ?? {},
          },
        };
      }
    } catch {
      ctx.status = ServerError.Status.InternalServerError;
      ctx.body = {
        __meta: {
          app: "Pylon",
          environment: ctx.state?.app?.environment,
          name: ctx.state?.app?.name,
          version: ctx.state?.app?.version,
        },
        error: {
          id: err.id ?? lindormId({ namespace: "err", length: 16 }),
          name: "UnexpectedException",
          title: "Unexpected Exception",
          message: "An unexpected exception occurred while handling thrown error",
          code: "unexpected_exception",
          type: "urn:lindorm:error:unexpected_exception",
          support: generateSupport(),
          data: {},
        },
      };
    }
  }
};
