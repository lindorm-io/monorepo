/** What `DataTable.create` / `createSet` parse a row through — a zod schema or any other. */
export type DataTableSchema<TOutput = unknown> = {
  parse(input: unknown): TOutput;
};

/** What `DataTable.createAsync` / `createSetAsync` parse a row through — a zod schema or any other. */
export type AsyncDataTableSchema<TOutput = unknown> = {
  parseAsync(input: unknown): Promise<TOutput>;
};
