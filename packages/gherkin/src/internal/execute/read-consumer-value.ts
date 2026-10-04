import { isError } from "@lindorm/is";

// A consumer can throw anything and give an error's `message`, `cause` or
// `code`, or a class's `name`, anything — a non-string, a value with no string
// form, a throwing getter, a Proxy — and a read that throws inside a catch site
// replaces the failure it reports, or rejects container disposal and loses
// every failure collected before it. Pinned: read-consumer-value.test.ts,
// run-scenario.lifecycle.test.ts ("a consumer value whose text cannot be read").
export const isReadableError = (value: unknown): value is Error => {
  try {
    return isError(value);
  } catch {
    return false;
  }
};

export const readValue = (read: () => unknown): unknown => {
  try {
    return read();
  } catch {
    return undefined;
  }
};

export const readText = (read: () => unknown): string => {
  try {
    return String(read());
  } catch {
    return "";
  }
};

export const readMessage = (error: Error): string => readText(() => error.message);

export const readCause = (error: Error): unknown => readValue(() => error.cause);

export const readThrownMessage = (thrown: unknown): string =>
  isReadableError(thrown) ? readMessage(thrown) : readText(() => thrown);
