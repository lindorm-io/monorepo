import { ClientError } from "@lindorm-io/errors";
import { DefaultLindormKoaContext, DefaultLindormMiddleware } from "../../types";
import { Schema } from "joi";
import { get } from "object-path";
import { Dict } from "@lindorm-io/common-types";

type From = "data" | "headers" | "params" | "query" | string;

const destructHeaders = (ctx: DefaultLindormKoaContext) => {
  const result: Dict = {};

  for (const [key, value] of Object.entries(ctx.headers)) {
    result[key] = value;
  }

  return result;
};

export const useSchema =
  (schema: Schema, from: From = "data"): DefaultLindormMiddleware =>
  async (ctx, next): Promise<void> => {
    try {
      const input = from === "headers" ? destructHeaders(ctx) : get(ctx, from);
      await schema.validateAsync(input);
    } catch (err: any) {
      throw new ClientError("Invalid request parameters", {
        code: "invalid_request_parameters",
        error: err,
        description: err.message,
        data: err.details,
        statusCode: ClientError.StatusCode.BAD_REQUEST,
      });
    }

    await next();
  };
