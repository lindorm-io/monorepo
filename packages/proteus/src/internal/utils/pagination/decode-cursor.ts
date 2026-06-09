import { ProteusError } from "../../../errors/index.js";

export type DecodedCursor = {
  columns: Array<string>;
  directions: Array<string>;
  values: Array<unknown>;
};

/**
 * Decode an opaque base64url cursor token and validate it against the
 * current query's orderBy columns and directions.
 *
 * Throws if the cursor is malformed, corrupted, or mismatched with the
 * current query (e.g. different columns or sort directions).
 */
export const decodeCursor = (
  token: string,
  expectedColumns: Array<string>,
  expectedDirections: Array<string>,
): DecodedCursor => {
  let parsed: unknown;

  try {
    const json = Buffer.from(token, "base64url").toString("utf8");
    parsed = JSON.parse(json);
  } catch {
    throw new ProteusError("Invalid pagination cursor: failed to decode token", {
      code: "invalid_cursor",
      title: "Invalid Cursor",
      details: "The pagination cursor token is corrupted and could not be decoded.",
    });
  }

  if (!Array.isArray(parsed) || parsed.length !== 3) {
    throw new ProteusError(
      "Invalid pagination cursor: expected [columns, directions, values]",
      {
        code: "invalid_cursor",
        title: "Invalid Cursor",
        details:
          "The pagination cursor must decode to a three-element array of columns, directions, and values.",
      },
    );
  }

  const [columns, directions, values] = parsed as [
    Array<string>,
    Array<string>,
    Array<unknown>,
  ];

  if (!Array.isArray(columns) || !Array.isArray(directions) || !Array.isArray(values)) {
    throw new ProteusError(
      "Invalid pagination cursor: columns, directions, and values must be arrays",
      {
        code: "invalid_cursor",
        title: "Invalid Cursor",
        details:
          "The pagination cursor columns, directions, and values must each be arrays.",
      },
    );
  }

  if (columns.length !== directions.length || columns.length !== values.length) {
    throw new ProteusError(
      "Invalid pagination cursor: columns, directions, and values must have equal length",
      {
        code: "invalid_cursor",
        title: "Invalid Cursor",
        details:
          "The pagination cursor columns, directions, and values must all have equal length.",
      },
    );
  }

  // Validate cursor matches the current query's orderBy
  if (columns.length !== expectedColumns.length) {
    throw new ProteusError(
      `Pagination cursor mismatch: cursor has ${columns.length} columns but query has ${expectedColumns.length}`,
      {
        code: "cursor_mismatch",
        title: "Cursor Mismatch",
        details:
          "The pagination cursor was created for a query with a different number of order columns.",
        data: {
          cursorColumnCount: columns.length,
          queryColumnCount: expectedColumns.length,
        },
      },
    );
  }

  for (let i = 0; i < columns.length; i++) {
    if (columns[i] !== expectedColumns[i]) {
      throw new ProteusError(
        `Pagination cursor mismatch: cursor column "${columns[i]}" does not match query column "${expectedColumns[i]}" at position ${i}`,
        {
          code: "cursor_mismatch",
          title: "Cursor Mismatch",
          details:
            "The pagination cursor was created for a different orderBy column ordering than the current query.",
          data: {
            position: i,
            cursorColumn: columns[i],
            queryColumn: expectedColumns[i],
          },
        },
      );
    }
    if (directions[i] !== expectedDirections[i]) {
      throw new ProteusError(
        `Pagination cursor mismatch: cursor direction "${directions[i]}" does not match query direction "${expectedDirections[i]}" for column "${columns[i]}"`,
        {
          code: "cursor_mismatch",
          title: "Cursor Mismatch",
          details:
            "The pagination cursor was created with a different sort direction than the current query.",
          data: {
            position: i,
            column: columns[i],
            cursorDirection: directions[i],
            queryDirection: expectedDirections[i],
          },
        },
      );
    }
  }

  return { columns, directions, values };
};
