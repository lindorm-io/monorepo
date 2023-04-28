import { SagaDestroyedError } from "../../../../src/error";
import { ErrorHandler } from "../../../../src/types";

export const main: ErrorHandler<SagaDestroyedError> = {
  error: SagaDestroyedError,
  handler: async ({ error, logger }) => {
    logger.warn("Error handler caught error", error);
  },
};
