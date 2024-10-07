import { Dict } from "@lindorm/types";

export type QueryOperator<T> = {
  $eq?: T | null; // Equal to or IS NULL
  $neq?: T | null; // Not equal to or IS NOT NULL
  $gt?: T; // Greater than
  $gte?: T; // Greater than or equal to
  $lt?: T; // Less than
  $lte?: T; // Less than or equal to
  $like?: T; // SQL LIKE for partial matches (e.g., `%value%`)
  $ilike?: T; // Case-insensitive LIKE (e.g., `ILIKE '%value%'`)
  $in?: Array<T>; // Matches any value in the array (e.g., `IN [value1, value2]`)
  $nin?: Array<T>; // Matches any value in the array (e.g., `IN [value1, value2]`)
  $between?: [T, T]; // Range queries (e.g., `BETWEEN value1 AND value2`)
};

// Allows for single values or operators for each field
export type Criteria<T extends Dict> = {
  [K in keyof T]?: T | QueryOperator<T[K]> | null;
};
