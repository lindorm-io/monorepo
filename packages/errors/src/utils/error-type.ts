import { snakeCase } from "@lindorm/case";
import { isString } from "@lindorm/is";

export const createErrorTypeUrn = (
  code: string | number | null,
  name: string,
): string => {
  if (isString(code)) {
    return `urn:lindorm:error:${snakeCase(code) || "unknown"}`;
  }

  const base = name.replace(/Error$/, "");
  const slug = base && base !== "Lindorm" ? snakeCase(base) : "unknown";

  return `urn:lindorm:error:${slug}`;
};

export const assertValidErrorType = (type: string): void => {
  if (!/^urn:/i.test(type)) {
    throw new TypeError(
      `Invalid error type "${type}": must be a URN (e.g. "urn:lindorm:error:...")`,
    );
  }
};
