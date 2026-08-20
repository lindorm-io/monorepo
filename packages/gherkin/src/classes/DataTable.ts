import { isUndefined } from "@lindorm/is";
import type { output, ZodType } from "zod";
import { ZodError } from "zod";
import { GherkinError } from "../errors/GherkinError.js";

/**
 * A step's DataTable argument, delivered in the trailing argument slot. The
 * five untyped methods are cucumber-js's exactly (models/data_table.ts, read
 * 2026-08-19): `raw`, `rows`, `hashes`, `rowsHash`, `transpose` — all values
 * `string`. Two deliberate divergences, both toward explicitness:
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
 *
 * Typed conversion is zod: `create`/`createSet` are SYNCHRONOUS (`.parse`) —
 * they run inside the consumer's step body where the runner cannot await
 * them, so a Promise return would let a forgotten `await` manufacture a
 * green. A schema with an async refinement makes `.parse` throw zod's own
 * "Encountered Promise during synchronous parse. Use .parseAsync() instead."
 * (measured, zod 4.4.3) — that error passes through UNTOUCHED so the message
 * naming the fix survives verbatim; use `createAsync`/`createSetAsync`.
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

    if (offending === -1) {
      return Object.fromEntries(this.cells.map((row) => [row[0], row[1]]));
    }

    throw new GherkinError(
      `rowsHash() requires every row to have exactly two columns — row ${offending + 1} has ${this.cells[offending].length}`,
      {
        code: "invalid_data_table",
        title: "Invalid Data Table Shape",
        details:
          "rowsHash() reads a two-column table as key/value pairs; a row with any other width has no key/value reading. Reshape the table, or use hashes() for header-keyed rows.",
        data: { columns: this.cells[offending].length, row: offending + 1 },
      },
    );
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
   * row would be the manufactured-green class. Vertical key/value tables
   * need no dedicated method: `schema.parse(table.rowsHash())`.
   */
  create<T extends ZodType>(schema: T): output<T> {
    return this.parseRow(schema, this.exactlyOneHash(), 1);
  }

  /** As `create`, via `.parseAsync` — for schemas with async refinements. */
  async createAsync<T extends ZodType>(schema: T): Promise<output<T>> {
    return await this.parseRowAsync(schema, this.exactlyOneHash(), 1);
  }

  /** Every `hashes()` row parsed through the schema, in table order. */
  createSet<T extends ZodType>(schema: T): Array<output<T>> {
    return this.hashes().map((row, index) => this.parseRow(schema, row, index + 1));
  }

  /** As `createSet`, via `.parseAsync` — for schemas with async refinements. */
  async createSetAsync<T extends ZodType>(schema: T): Promise<Array<output<T>>> {
    const set: Array<output<T>> = [];

    for (const [index, row] of this.hashes().entries()) {
      set.push(await this.parseRowAsync(schema, row, index + 1));
    }

    return set;
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
        title: "Invalid Data Table Shape",
        details:
          "create() returns ONE object, so the table must carry a header row and exactly one body row — converting any other count would silently truncate or invent data.",
        data: { bodyRows: hashes.length },
      },
    );
  }

  private parseRow<T extends ZodType>(
    schema: T,
    row: Record<string, string>,
    bodyRow: number,
  ): output<T> {
    try {
      return schema.parse(row);
    } catch (error) {
      throw this.toConversionError(error, bodyRow);
    }
  }

  private async parseRowAsync<T extends ZodType>(
    schema: T,
    row: Record<string, string>,
    bodyRow: number,
  ): Promise<output<T>> {
    try {
      return await schema.parseAsync(row);
    } catch (error) {
      throw this.toConversionError(error, bodyRow);
    }
  }

  private toConversionError(error: unknown, bodyRow: number): unknown {
    // ONLY a ZodError is wrapped (zod's Symbol.hasInstance makes this
    // marker-based — dual-install safe). Everything else rethrows untouched:
    // zod's $ZodAsyncError must keep its fix-naming message verbatim, and a
    // consumer refinement throwing its own error keeps its identity so
    // assertion diffs survive. The step anchor is prepended by the runner's
    // step-failure path either way.
    if (error instanceof ZodError) {
      return new GherkinError(
        `Data table body row ${bodyRow} failed schema conversion\n\n${error.message}`,
        {
          code: "table_conversion_failed",
          title: "Data Table Conversion Failed",
          details:
            "The table's string cells did not satisfy the zod schema. Fix the table in the feature file, or the schema — string cells usually need z.coerce for numbers, booleans and dates.",
          // EXPLICIT, mirroring conversion_failed: the wrapper's urn must
          // never depend on the inner error's shape.
          type: "urn:lindorm:gherkin:error:table_conversion_failed",
          data: { issues: error.issues, row: bodyRow },
          error,
        },
      );
    }

    return error;
  }
}
