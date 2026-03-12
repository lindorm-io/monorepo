import { ProteusError } from "../../../../errors/ProteusError";

/**
 * Quotes a MySQL identifier using backtick quoting.
 * Escapes embedded backticks by doubling them.
 */
export const quoteIdentifier = (name: string): string => {
  if (!name) {
    throw new ProteusError("Identifier cannot be empty");
  }
  return `\`${name.replace(/`/g, "``")}\``;
};

export const quoteQualifiedName = (
  namespace: string | null | undefined,
  name: string,
): string =>
  namespace
    ? `${quoteIdentifier(namespace)}.${quoteIdentifier(name)}`
    : quoteIdentifier(name);
