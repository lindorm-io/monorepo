import { isError, isString } from "@lindorm/is";

const reportedMessage = new WeakMap<Error, string>();

// A consumer can throw anything and give an error's `message` or `cause`
// anything — a non-string, a value with no string form, a throwing getter, a
// Proxy — and a read that throws here escapes the catch sites in
// run-scenario.ts (the after-phases never run) and feature-hooks.ts (the
// hook's error is replaced). Pinned: anchor-error.test.ts.
const isReadableError = (value: unknown): value is Error => {
  try {
    return isError(value);
  } catch {
    return false;
  }
};

const readText = (read: () => unknown): string => {
  try {
    return String(read());
  } catch {
    return "";
  }
};

const readMessage = (error: Error): string => readText(() => error.message);

const readCause = (error: Error): unknown => {
  try {
    return error.cause;
  } catch {
    return undefined;
  }
};

const writeMessage = (error: Error, message: string): boolean => {
  // Module code is strict: a frozen instance, a read-only `message` or a
  // non-extensible error without its own `message` throws here rather than
  // ignoring the write; a setter that swallows it, or a getter that hides it,
  // fails the read-back. Pinned: anchor-error.test.ts.
  try {
    error.message = message;
  } catch {
    return false;
  }

  return readMessage(error) === message;
};

const anchorInstance = (error: Error, format: (message: string) => string): Error => {
  const reported = reportedMessage.get(error);

  if (isString(reported)) {
    return new Error(format(reported), { cause: error });
  }

  const message = readMessage(error);

  if (writeMessage(error, format(message))) {
    reportedMessage.set(error, message);
    return error;
  }

  return new Error(format(message), { cause: error });
};

export const anchorError = (
  thrown: unknown,
  format: (message: string) => string,
): Error =>
  isReadableError(thrown)
    ? anchorInstance(thrown, format)
    : new Error(format(readText(() => thrown)), { cause: thrown });

export const markReported = (error: Error): void => {
  // A cause chain can loop back on itself; pinned: anchor-error.test.ts.
  const seen = new Set<Error>();
  let current: unknown = error;

  while (isReadableError(current) && !seen.has(current)) {
    seen.add(current);

    if (!reportedMessage.has(current)) {
      reportedMessage.set(current, readMessage(current));
    }

    current = readCause(current);
  }
};
