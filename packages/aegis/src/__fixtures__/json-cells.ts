import type { DataTable } from "@lindorm/gherkin";
import type { Dict } from "@lindorm/types";

/** Every value cell is JSON, so a table states a list, a number, an object or the empty string unambiguously. */
export const jsonCells = (table: DataTable): Dict =>
  Object.fromEntries(
    Object.entries(table.rowsHash()).map(([key, cell]) => {
      try {
        return [key, JSON.parse(cell)];
      } catch {
        throw new Error(`the cell for "${key}" is not JSON: ${cell}`);
      }
    }),
  );
