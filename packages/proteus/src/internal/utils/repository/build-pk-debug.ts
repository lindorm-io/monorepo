/**
 * Build a debug object from primary key fields for error messages.
 */
export const buildPrimaryKeyDebug = (
  source: Record<string, unknown>,
  primaryKeys: Array<string>,
): Record<string, unknown> => {
  const result: Record<string, unknown> = {};
  for (const key of primaryKeys) {
    result[key] = source[key];
  }
  return result;
};
