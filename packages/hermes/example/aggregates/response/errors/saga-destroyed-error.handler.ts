import { IErrorHandler, SagaDestroyedError } from "../../../../src";

export const main: IErrorHandler<SagaDestroyedError> = {
  error: SagaDestroyedError,
  handler: async ({ error, logger }) => {
    logger.warn("Error handler caught error", error);
  },
};
