import { isString, isUndefined } from "@lindorm/is";
import { GherkinError } from "../errors/GherkinError.js";
import type {
  AsyncDataTableSchema,
  DataTableSchema,
} from "../types/data-table-schema.js";
import { isZodShaped } from "./is-zod-shaped.js";

type DuplicateKey = {
  key: string;
  positions: Array<number>;
};

/**
 * A step's DataTable argument, delivered in the trailing argument slot. The
 * five untyped methods are cucumber-js's exactly (models/data_table.ts, read
 * 2026-08-19): `raw`, `rows`, `hashes`, `rowsHash`, `transpose` — all values
 * `string`. Three deliberate divergences, all toward explicitness:
 *
 * - COPYING: cucumber's `raw()` is a shallow `slice(0)`, so mutating an inner
 *   row through it corrupts every later `hashes()`/`rows()` call on the same
 *   instance. Here the constructor copies its input and `raw()` returns a
 *   fresh deep copy per call — the instance is immutable from outside, and
 *   the model rows it was built from can never be corrupted (pinned:
 *   DataTable.test.ts).
 * - EMPTY TABLES: cucumber's `transpose()`/`hashes()` crash with a TypeError
 *   on a zero-row table; here every method is total (empty in, empty out).
 *   Gherkin cannot produce a zero-row table, but the constructor is public.
 * - UNIQUE KEYS: a repeated `hashes()` header cell or `rowsHash()` key
 *   overwrites the earlier cell under cucumber's last-write-wins assignment,
 *   so a cell the feature file carries never reaches the step. Here both
 *   throw `invalid_data_table` (pinned: DataTable.test.ts).
 *
 * Typed conversion takes a schema with `parse` / `parseAsync` (zod or any
 * other): `create`/`createSet` are SYNCHRONOUS (`.parse`) — they run inside
 * the consumer's step body where the runner cannot await them, so a Promise
 * return would let a forgotten `await` manufacture a green. A zod schema with
 * an async refinement makes `.parse` throw zod's own "Encountered Promise
 * during synchronous parse. Use .parseAsync() instead." (measured, zod 4.4.3)
 * — that error passes through UNTOUCHED so the message naming the fix
 * survives verbatim; use `createAsync`/`createSetAsync`. A zod validation
 * error, from any zod copy, becomes `table_conversion_failed`; anything else
 * the schema throws reaches the caller untouched.
 */
export class DataTable {
  private readonly cells: Array<Array<string>>;

  constructor(rows: Array<Array<string>>) {
    this.cells = rows.map((row) => [...row]);
  }

  /** The full cell matrix, header included — a fresh deep copy per call. */
  raw(): Array<Array<string>> {
    return this.cells.map((row) => [...row]);
  }

  /** The body rows — everything below the header row. */
  rows(): Array<Array<string>> {
    return this.raw().slice(1);
  }

  /** One Record per body row, keyed by the header row. */
  hashes(): Array<Record<string, string>> {
    const [header, ...body] = this.cells;

    if (isUndefined(header)) {
      return [];
    }

    const duplicate = this.duplicateKey(header);

    if (!isUndefined(duplicate)) {
      throw new GherkinError(
        `hashes() requires unique header cells — "${duplicate.key}" appears in columns ${duplicate.positions.join(", ")}`,
        {
          code: "invalid_data_table",
          details:
            "Each body row becomes one Record keyed by the header, so a repeated header cell would discard every value under it but the last. Rename the columns, or read the table through raw().",
          data: { columns: duplicate.positions, key: duplicate.key },
        },
      );
    }

    // Object.fromEntries creates OWN data properties, so a "__proto__"
    // header cell survives as a readable key — cucumber's `object[key] =`
    // assignment would silently set the prototype instead (the examplesRow /
    // ScenarioInfo ruling). Pinned: DataTable.test.ts.
    return body.map((row) =>
      Object.fromEntries(header.map((key, index) => [key, row[index]])),
    );
  }

  /**
   * A two-column table as one key/value Record — ALL rows are data, there is
   * no header (cucumber-js semantics). A table with any other column count
   * throws, exactly as cucumber-js does.
   */
  rowsHash(): Record<string, string> {
    const offending = this.cells.findIndex((row) => row.length !== 2);

    if (offending !== -1) {
      throw new GherkinError(
        `rowsHash() requires every row to have exactly two columns — row ${offending + 1} has ${this.cells[offending].length}`,
        {
          code: "invalid_data_table",
          details:
            "rowsHash() reads a two-column table as key/value pairs; a row with any other width has no key/value reading. Reshape the table, or use hashes() for header-keyed rows.",
          data: { row: offending + 1, width: this.cells[offending].length },
        },
      );
    }

    const duplicate = this.duplicateKey(this.cells.map(([key]) => key));

    if (!isUndefined(duplicate)) {
      throw new GherkinError(
        `rowsHash() requires unique keys — "${duplicate.key}" appears in rows ${duplicate.positions.join(", ")}`,
        {
          code: "invalid_data_table",
          details:
            "rowsHash() reads every row as one key/value pair, so a repeated key would discard every value under it but the last. Rename the keys, or read the table through raw().",
          data: { key: duplicate.key, rows: duplicate.positions },
        },
      );
    }

    return Object.fromEntries(this.cells.map((row) => [row[0], row[1]]));
  }

  /** The matrix transposed — a NEW DataTable; this one is untouched. */
  transpose(): DataTable {
    const [first] = this.cells;

    if (isUndefined(first)) {
      return new DataTable([]);
    }

    return new DataTable(first.map((_, index) => this.cells.map((row) => row[index])));
  }

  /**
   * The table's SINGLE body row parsed through the schema — the horizontal
   * reading (header + one body row), the same row shape `createSet` parses.
   * Any other body-row count throws loudly; silent truncation to the first
   * row would be the manufactured-green class. A vertical key/value table
   * converts through `table.transpose().create(schema)`.
   */
  create<TOutput>(schema: DataTableSchema<TOutput>): TOutput {
    return this.parseRow(schema, this.exactlyOneHash(), 1);
  }

  /** As `create`, via `.parseAsync` — for schemas with async refinements. */
  async createAsync<TOutput>(schema: AsyncDataTableSchema<TOutput>): Promise<TOutput> {
    return await this.parseRowAsync(schema, this.exactlyOneHash(), 1);
  }

  /** Every `hashes()` row parsed through the schema, in table order. */
  createSet<TOutput>(schema: DataTableSchema<TOutput>): Array<TOutput> {
    return this.hashes().map((row, index) => this.parseRow(schema, row, index + 1));
  }

  /** As `createSet`, via `.parseAsync` — for schemas with async refinements. */
  async createSetAsync<TOutput>(
    schema: AsyncDataTableSchema<TOutput>,
  ): Promise<Array<TOutput>> {
    const set: Array<TOutput> = [];

    for (const [index, row] of this.hashes().entries()) {
      set.push(await this.parseRowAsync(schema, row, index + 1));
    }

    return set;
  }

  /** The first key occurring more than once, with its one-based positions. */
  private duplicateKey(keys: Array<string>): DuplicateKey | undefined {
    const seen = new Map<string, Array<number>>();

    for (const [index, key] of keys.entries()) {
      seen.set(key, [...(seen.get(key) ?? []), index + 1]);
    }

    for (const [key, positions] of seen) {
      if (positions.length > 1) {
        return { key, positions };
      }
    }

    return undefined;
  }

  private exactlyOneHash(): Record<string, string> {
    const hashes = this.hashes();

    if (hashes.length === 1) {
      return hashes[0];
    }

    throw new GherkinError(
      `create() converts exactly one body row — this table has ${hashes.length}. Use createSet() for multi-row tables.`,
      {
        code: "invalid_data_table",
        details:
          "create() returns ONE object, so the table must carry a header row and exactly one body row — converting any other count would silently truncate or invent data.",
        data: { bodyRows: hashes.length },
      },
    );
  }

  private parseRow<TOutput>(
    schema: DataTableSchema<TOutput>,
    row: Record<string, string>,
    bodyRow: number,
  ): TOutput {
    try {
      return schema.parse(row);
    } catch (error) {
      throw this.toConversionError(error, bodyRow);
    }
  }

  private async parseRowAsync<TOutput>(
    schema: AsyncDataTableSchema<TOutput>,
    row: Record<string, string>,
    bodyRow: number,
  ): Promise<TOutput> {
    try {
      return await schema.parseAsync(row);
    } catch (error) {
      throw this.toConversionError(error, bodyRow);
    }
  }

  private toConversionError(error: unknown, bodyRow: number): unknown {
    if (isZodShaped(error)) {
      const summary = `Data table body row ${bodyRow} failed schema conversion`;

      return new GherkinError(
        isString(error.message) ? `${summary}\n\n${error.message}` : summary,
        {
          code: "table_conversion_failed",
          details:
            "The table's string cells did not satisfy the schema. Fix the table in the feature file, or the schema — every cell is a string, so zod needs z.coerce.number() for numbers and z.stringbool() for booleans.",
          data: { issues: error.issues, row: bodyRow },
          cause: error,
        },
      );
    }

    return error;
  }
}
