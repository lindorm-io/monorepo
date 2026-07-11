import { hashIdentifier } from "./hash-identifier.js";

/**
 * Canonical constraint/index name builders shared by ALL SQL dialects
 * (postgres, mysql, sqlite).
 *
 * D1: there is ONE name formula per constraint kind — the original postgres
 * formula. Postgres is the primary dialect, so its names must never change;
 * mysql previously derived FK names from a longer input (extra foreign-table /
 * foreign-column suffixes) and drifted. Adopting the canonical formula costs a
 * one-time FK drop+re-add on existing mysql databases (accepted churn).
 *
 * Every producer of a generated `fk_` / `uq_` / `chk_` / `idx_` name MUST call
 * these builders — no inline `<prefix>_${hashIdentifier(...)}` templates
 * anywhere else.
 */

/**
 * Foreign-key constraint name: `fk_<hash(`${tableName}_${columnName}`)>`.
 *
 * Used for relation FKs, join-table FKs, and embedded-list (collection table)
 * FKs — the input is the table carrying the FK column plus that column's name.
 */
export const buildForeignKeyName = (tableName: string, columnName: string): string =>
  `fk_${hashIdentifier(`${tableName}_${columnName}`)}`;

/**
 * Inheritance (joined child → root) FK name:
 * `fk_<hash(`${tableName}_inh_${rootName}`)>`.
 *
 * The `_inh_` marker keeps the child-PK→root-PK FK distinct from a relation FK
 * on the same table; PK column names are deliberately NOT part of the input.
 */
export const buildInheritanceForeignKeyName = (
  tableName: string,
  rootName: string,
): string => `fk_${hashIdentifier(`${tableName}_inh_${rootName}`)}`;

/**
 * Unique constraint name: `uq_<hash(`${tableName}_${columns.join("_")}`)>`.
 */
export const buildUniqueName = (tableName: string, columns: Array<string>): string =>
  `uq_${hashIdentifier(`${tableName}_${columns.join("_")}`)}`;

/**
 * Check constraint name: `chk_<hash(`${tableName}_${expression}`)>` — the raw
 * check expression is the hash input, so a changed expression yields a new name.
 */
export const buildCheckName = (tableName: string, expression: string): string =>
  `chk_${hashIdentifier(`${tableName}_${expression}`)}`;

/**
 * Index name: `idx_<hash(`${tableName}_${columns.join("_")}`)>`.
 *
 * Used for auto-named indexes, discriminator indexes, join-table reverse-side
 * indexes, and embedded-list FK indexes.
 */
export const buildIndexName = (tableName: string, columns: Array<string>): string =>
  `idx_${hashIdentifier(`${tableName}_${columns.join("_")}`)}`;
