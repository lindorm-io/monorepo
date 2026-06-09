import { ProteusError } from "../../../../errors/ProteusError.js";

/**
 * Quotes a MySQL identifier using backtick quoting.
 * Escapes embedded backticks by doubling them.
 */
export const quoteIdentifier = (name: string): string => {
  if (!name) {
    throw new ProteusError("Identifier cannot be empty", {
      code: "invalid_query",
      title: "Invalid Query",
      details: "An empty identifier cannot be quoted for use in a MySQL statement.",
    });
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
