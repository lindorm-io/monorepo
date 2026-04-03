import {
  addMilliseconds,
  isAfter,
  isBefore,
  ms,
  ReadableTime,
  subMilliseconds,
} from "@lindorm/date";
import { ClientError } from "@lindorm/errors";
import { PylonHttpMiddleware } from "../../types";

type Options = {
  minRequestAge?: ReadableTime;
  maxRequestAge?: ReadableTime;
};

export const createHttpDateValidationMiddleware = (
  options: Options,
): PylonHttpMiddleware => {
  const minRequestAge = options.minRequestAge ?? "10s";
  const maxRequestAge = options.maxRequestAge ?? "10s";

  return async function httpDateValidationMiddleware(ctx, next) {
    const minDate = subMilliseconds(new Date(), ms(minRequestAge));
    const maxDate = addMilliseconds(new Date(), ms(maxRequestAge));

    if (isBefore(ctx.state.metadata.date, minDate)) {
      throw new ClientError("Suspicious request denied", {
        code: "replay_denied",
        details: "Request has been identified as a likely replay attack",
        data: {
          actual: ctx.state.metadata.date.toISOString(),
          expect: minDate.toISOString(),
        },
      });
    }

    if (isAfter(ctx.state.metadata.date, maxDate)) {
      throw new ClientError("Suspicious request denied", {
        code: "suspicious_request",
        details: "Request has been identified as suspicious",
        data: {
          actual: ctx.state.metadata.date.toISOString(),
          expect: maxDate.toISOString(),
        },
      });
    }

    await next();
  };
};
