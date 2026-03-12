/** MySQL identifiers (table names, column names) are limited to 64 characters. */
export const MYSQL_IDENTIFIER_LIMIT = 64;

/** Minimum supported MySQL version. 8.0.19 introduced VALUES ROW() and CTE improvements. */
export const MYSQL_MIN_VERSION = "8.0.19";

/**
 * Prefix length applied to TEXT/BLOB columns when used in MySQL indexes or
 * unique constraints. 191 chars × 4 bytes (utf8mb4) = 764 bytes, which fits
 * within MySQL's 767-byte index key limit for InnoDB.
 */
export const INDEX_PREFIX_LENGTH = 191;
