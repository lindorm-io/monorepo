import { AegisError } from "../errors/index.js";

const projectionOf = (error: unknown): unknown => {
  if (!(error instanceof AegisError)) throw error;

  const { name, code, data, debug, message } = error;

  return { name, code, data, debug, message };
};

/**
 * What a caller learns from a synchronous act's refusal — the class, the code,
 * both bags and the message — as one value a snapshot can freeze. A thrown
 * `Error` snapshots as its message alone.
 */
export const refusalOf = (act: () => unknown): unknown => {
  try {
    act();
  } catch (error) {
    return projectionOf(error);
  }

  throw new Error("the act was not refused");
};

/** {@link refusalOf} for an asynchronous act, read off its rejection. */
export const rejectionOf = async (act: () => Promise<unknown>): Promise<unknown> => {
  try {
    await act();
  } catch (error) {
    return projectionOf(error);
  }

  throw new Error("the act was not refused");
};
