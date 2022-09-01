import { ErrorHandler } from "../../../../src/types";
import { SagaDestroyedError } from "../../../../src/error";

export const main: ErrorHandler<SagaDestroyedError> = {
  error: SagaDestroyedError,
  handler: async (ctx) => {
    ctx.logger.warn("Error handler caught error", ctx.error);
  },
};
