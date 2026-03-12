/**
 * Encode keyset cursor values into an opaque base64url token.
 *
 * The cursor payload is a JSON array: [columns, directions, values].
 * Columns and directions are embedded so decode can validate that the cursor
 * matches the current query's orderBy.
 *
 * NOTE: Cursors are NOT integrity-protected (no HMAC). Multi-tenant deployments
 * must enforce scope independently via @ScopeField auto-filter.
 */
export const encodeCursor = (
  columns: Array<string>,
  directions: Array<string>,
  values: Array<unknown>,
): string => {
  const payload = JSON.stringify([columns, directions, values]);
  return Buffer.from(payload, "utf8").toString("base64url");
};
