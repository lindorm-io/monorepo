import { ProteusError } from "../../../errors";

export const quoteIdentifier = (name: string): string => {
  if (!name) {
    throw new ProteusError("Identifier cannot be empty");
  }
  return `"${name.replace(/"/g, '""')}"`;
};

export const quoteQualifiedName = (namespace: string | null, name: string): string =>
  namespace
    ? `${quoteIdentifier(namespace)}.${quoteIdentifier(name)}`
    : quoteIdentifier(name);
