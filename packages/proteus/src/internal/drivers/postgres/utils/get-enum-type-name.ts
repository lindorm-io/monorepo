import { hashIdentifier } from "./hash-identifier.js";

/**
 * Generates a PostgreSQL enum type name from the table and field names. Falls back
 * to a hash-based name if the readable name exceeds the 63-character PG identifier limit.
 */
export const getEnumTypeName = (tableName: string, fieldKey: string): string => {
  const readable = `enum_${tableName}_${fieldKey}`;
  if (readable.length <= 63) return readable;
  return `enum_${hashIdentifier(`${tableName}_${fieldKey}`)}`;
};
