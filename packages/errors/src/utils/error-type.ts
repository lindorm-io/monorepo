import { snakeCase } from "@lindorm/case";
import { isString } from "@lindorm/is";

const createErrorSlug = (
  code: string | number | null,
  name: string,
  namespace: string | null,
): string => {
  if (isString(code)) {
    return snakeCase(code) || "unknown";
  }

  const slug = snakeCase(name.replace(/Error$/, ""));

  if (!slug || slug === "lindorm" || slug === namespace) {
    return "unknown";
  }

  return slug;
};

export const createErrorTypeUrn = (
  code: string | number | null,
  name: string,
  namespace: string | null = null,
): string => {
  const prefix = `urn:lindorm:${namespace ? `${namespace}:` : ""}error`;

  return `${prefix}:${createErrorSlug(code, name, namespace)}`;
};

export const assertValidErrorType = (type: string): void => {
  if (!/^urn:/i.test(type)) {
    throw new TypeError(
      `Invalid error type "${type}": must be a URN (e.g. "urn:lindorm:error:...")`,
    );
  }
};
