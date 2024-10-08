import { Dict } from "@lindorm/types";
import { QueryConfig } from "pg";
import { IPostgresQueryBuilder } from "../interfaces";
import {
  InsertOptions,
  PostgresQueryBuilderOptions,
  SelectOptions,
  UpdateOptions,
} from "../types";
import {
  handleOrdering,
  handlePagination,
  handleSelectColumns,
  handleWhere,
  quotation,
  validateInsertAttributes,
  validateTableName,
} from "../utils/private";
import { handleReturning } from "../utils/private/handle-returning";

export class PostgresQueryBuilder<T extends Dict> implements IPostgresQueryBuilder<T> {
  private readonly table: string;

  public constructor(options: PostgresQueryBuilderOptions) {
    validateTableName(options.table);
    this.table = quotation(options.table);
  }

  public delete(criteria: Partial<T>): QueryConfig {
    let text = `DELETE FROM ${this.table}`;
    const values: Array<any> = [];

    const where = handleWhere<T>(criteria);
    text += where.text;
    values.push(...where.values);

    return { text, values };
  }

  public insert(attributes: T, options?: InsertOptions<T>): QueryConfig {
    return this.handleInsert([attributes], options);
  }

  public insertMany(array: Array<T>, options?: InsertOptions<T>): QueryConfig {
    return this.handleInsert(array, options);
  }

  public select(criteria: Partial<T>, options: SelectOptions<T> = {}): QueryConfig {
    let text = "SELECT ";
    const values: Array<any> = [];

    if (options.distinct) {
      text += "DISTINCT ";
    }

    const select = handleSelectColumns(options);
    text += select.text;
    values.push(...select.values);

    text += " FROM " + this.table;

    const where = handleWhere<T>(criteria);
    text += where.text;
    values.push(...where.values);

    const ordering = handleOrdering(options);
    text += ordering.text;
    values.push(...ordering.values);

    const pagination = handlePagination(options);
    text += pagination.text;
    values.push(...pagination.values);

    return { text, values };
  }

  public update(
    criteria: Partial<T>,
    attributes: Partial<T>,
    options: UpdateOptions<T> = {},
  ): QueryConfig {
    const updateKeys = Object.keys(attributes);
    const values: Array<any> = [];

    let setClause = "";

    for (const key of updateKeys) {
      const quotedKey = quotation(key);

      setClause += `${quotedKey} = ?, `;
      values.push(attributes[key]);
    }

    setClause = setClause.slice(0, -2);

    let text = `UPDATE ${this.table} SET ${setClause}`;

    const where = handleWhere<T>(criteria);
    text += where.text;
    values.push(...where.values);

    const returning = handleReturning(options);
    text += returning.text;

    return { text, values };
  }

  public upsert(
    criteria: Partial<T>,
    attributes: Partial<T>,
    options: UpdateOptions<T> = {},
  ): QueryConfig {
    const conflictKeys = Object.keys(criteria);
    const insertKeys = Object.keys(attributes);
    const values = [];

    let columns = "";
    let placeholders = "";
    let updates = "";

    for (const key of insertKeys) {
      const quotedKey = quotation(key);
      columns += `${quotedKey}, `;
      placeholders += "?, ";
      values.push(attributes[key]);
      updates += `${quotedKey} = EXCLUDED.${quotedKey}, `;
    }

    columns = columns.slice(0, -2);
    placeholders = placeholders.slice(0, -2);
    updates = updates.slice(0, -2);

    let text = `INSERT INTO ${this.table} (${columns}) VALUES (${placeholders})`;

    if (conflictKeys.length) {
      const conflictColumns = conflictKeys.map(quotation).join(", ");
      text += ` ON CONFLICT (${conflictColumns}) DO UPDATE SET ${updates}`;
    }

    const returning = handleReturning(options);
    text += returning.text;

    return { text, values };
  }

  private handleInsert(
    attributesArray: Array<T>,
    options: InsertOptions<T> = {},
  ): QueryConfig {
    validateInsertAttributes(attributesArray);

    const firstAttributes = attributesArray[0];
    const insertKeys = Object.keys(firstAttributes);
    const values: Array<any> = [];

    let columns = "";
    let placeholders = "";
    let allPlaceholders = "";

    for (const key of insertKeys) {
      const quotedKey = quotation(key);

      columns += `${quotedKey}, `;

      placeholders += "?, ";
    }

    columns = columns.slice(0, -2);
    placeholders = placeholders.slice(0, -2);

    for (const attributes of attributesArray) {
      allPlaceholders += `(${placeholders}), `;
      values.push(...Object.values(attributes));
    }

    allPlaceholders = allPlaceholders.slice(0, -2);

    let text = `INSERT INTO ${this.table} (${columns}) VALUES ${allPlaceholders}`;

    const returning = handleReturning(options);
    text += returning.text;

    return { text, values };
  }
}
