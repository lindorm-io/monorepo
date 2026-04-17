import { DeadlockError } from "../../../../errors/DeadlockError";
import { SerializationError } from "../../../../errors/SerializationError";

export const isRetryableTransactionError = (error: unknown): boolean =>
  error instanceof SerializationError || error instanceof DeadlockError;
