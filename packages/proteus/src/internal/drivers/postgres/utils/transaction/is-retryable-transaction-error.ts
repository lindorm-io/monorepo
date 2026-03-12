import { DeadlockError } from "#internal/errors/DeadlockError";
import { SerializationError } from "#internal/errors/SerializationError";

export const isRetryableTransactionError = (error: unknown): boolean =>
  error instanceof SerializationError || error instanceof DeadlockError;
