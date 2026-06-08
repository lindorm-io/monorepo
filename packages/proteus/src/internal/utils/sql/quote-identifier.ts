import { ProteusError } from "../../../errors/index.js";

export const quoteIdentifier = (name: string): string => {
  if (!name) {
    throw new ProteusError("Identifier cannot be empty", {
      code: "empty_identifier",
    });
  }
  return `"${name.replace(/"/g, '""')}"`;
};

export const quoteQualifiedName = (namespace: string | null, name: string): string =>
  namespace
    ? `${quoteIdentifier(namespace)}.${quoteIdentifier(name)}`
    : quoteIdentifier(name);
