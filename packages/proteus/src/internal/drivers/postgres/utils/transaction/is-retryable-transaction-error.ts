import { DeadlockError } from "../../../../errors/DeadlockError.js";
import { SerializationError } from "../../../../errors/SerializationError.js";

export const isRetryableTransactionError = (error: unknown): boolean =>
  error instanceof SerializationError || error instanceof DeadlockError;
