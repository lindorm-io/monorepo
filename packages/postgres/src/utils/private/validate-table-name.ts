export const validateTableName = (table: string): void => {
  if (!table) {
    throw new TypeError("Table name must be provided");
  }

  if (typeof table !== "string") {
    throw new TypeError("Table name must be a string");
  }

  if (!table.length) {
    throw new TypeError("Table name must contain at least one character");
  }

  if (table.includes(" ")) {
    throw new TypeError("Table name must not contain spaces");
  }
};
