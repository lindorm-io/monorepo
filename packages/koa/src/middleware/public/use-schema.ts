import { DefaultLindormMiddleware } from "../../types";
import { Schema, ValidationError } from "joi";
import { ClientError } from "@lindorm-io/errors";

export const useSchema =
  (schema: Schema): DefaultLindormMiddleware =>
  async (ctx, next): Promise<void> => {
    try {
      await schema.validateAsync(ctx.data);
    } catch (err) {
      if (err instanceof ValidationError) {
        throw new ClientError("Invalid request parameters", {
          code: "invalid_request_parameters",
          error: err,
          description: err.message,
          statusCode: ClientError.StatusCode.BAD_REQUEST,
        });
      }

      throw err;
    }

    await next();
  };
