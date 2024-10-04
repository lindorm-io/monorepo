import { isArray, isNumber, isObject, isString } from "@lindorm/is";
import { Dict } from "@lindorm/types";
import { QueryConfig } from "pg";
import { IPostgresQueryBuilder } from "../interfaces";
import {
  InsertOptions,
  PostgresQueryBuilderOptions,
  SelectOptions,
  UpdateOptions,
} from "../types";

export class PostgresQueryBuilder<T extends Dict> implements IPostgresQueryBuilder<T> {
  private readonly table: string;

  public constructor(options: PostgresQueryBuilderOptions) {
    this.validateTableName(options.table);
    this.table = options.table;
  }

  // public

  public insert(attributes: T, options?: InsertOptions<T>): QueryConfig {
    return this.handleInsert([attributes], options);
  }

  public insertMany(array: Array<T>, options?: InsertOptions<T>): QueryConfig {
    return this.handleInsert(array, options);
  }

  public select(criteria: Partial<T>, options: SelectOptions<T> = {}): QueryConfig {
    let text = "SELECT ";

    const columns = options.columns ?? "*";
    const values: Array<any> = [];

    if (isString(columns)) {
      text += columns + ", ";
    } else if (isArray(columns)) {
      for (const key of columns) {
        if (!isString(key)) {
          throw new TypeError("Columns must be an array of strings");
        }

        text += '"' + key + '", ';
      }
    } else {
      throw new TypeError("Columns must be * or an array of strings");
    }

    text = text.slice(0, -2) + " FROM " + this.table + " WHERE ";

    for (const [key, value] of Object.entries(criteria)) {
      if (!isString(key)) {
        throw new TypeError("Criteria key must be a string");
      }

      text += '"' + key + '" = ? AND ';

      values.push(value);
    }

    text = text.slice(0, -5);

    if (options.order) {
      text += " ORDER BY ";

      for (const [key, value] of Object.entries(options.order)) {
        if (!isString(key)) {
          throw new TypeError("Order key must be a string");
        }

        text += '"' + key + '" ' + value + ", ";
      }

      text = text.slice(0, -2);
    }

    if (options.limit) {
      if (!isNumber(options.limit)) {
        throw new TypeError("Limit must be a number");
      }

      text += " LIMIT " + options.limit;
    }

    if (options.offset) {
      if (!isNumber(options.offset)) {
        throw new TypeError("Offset must be a number");
      }

      text += " OFFSET " + options.offset;
    }

    return { text, values };
  }

  public update(
    criteria: Partial<T>,
    attributes: Partial<T>,
    options: UpdateOptions<T> = {},
  ): QueryConfig {
    const whereKeys = Object.keys(criteria);
    const setKeys = Object.keys(attributes);
    const values = [];

    let text = "UPDATE " + this.table + " SET ";

    for (const key of setKeys) {
      text += key + " = ?, ";
      values.push(attributes[key]);
    }

    text = text.slice(0, -2) + " WHERE ";

    for (const key of whereKeys) {
      text += key + " = ? AND ";
      values.push(criteria[key]);
    }

    text = text.slice(0, -5);

    text = this.handleReturning(text, options.returning);

    return { text, values };
  }

  // private

  private handleInsert(
    attributes: Array<T>,
    options: InsertOptions<T> = {},
  ): QueryConfig {
    this.validateInsertAttributes(attributes);

    const keys = Object.keys(attributes[0]);
    const values = [];

    let text = "INSERT INTO " + this.table + " (";

    for (const key of keys) {
      text += key + ",";
    }

    text = text.slice(0, -1) + ") VALUES ";

    for (const attribute of attributes) {
      text += "(";

      for (const _ of keys) {
        text += "?,";
      }

      text = text.slice(0, -1) + "),";

      for (const item of Object.values(attribute)) {
        values.push(item);
      }
    }

    text = text.slice(0, -1);

    text = this.handleReturning(text, options.returning);

    return { text, values };
  }

  private handleReturning(text: string, returning?: "*" | Array<keyof T>): string {
    if (!returning) return text;

    text += " RETURNING ";

    if (isString(returning)) {
      text += returning + ", ";
    } else if (isArray(returning)) {
      for (const item of returning) {
        if (!isString(item)) {
          throw new TypeError("Returns must be an array of strings");
        }
        text += item + ", ";
      }
    }

    return text.slice(0, -2);
  }

  private validateTableName(table: string): void {
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
  }

  private validateInsertAttributes(attributes: Array<T>): void {
    if (!isArray(attributes)) {
      throw new TypeError("Attributes must be an array");
    }

    if (!attributes.length) {
      throw new TypeError("Attributes must contain at least one item");
    }

    const keys = Object.keys(attributes[0]);

    for (const attribute of attributes) {
      if (!isObject(attribute)) {
        throw new TypeError("Attribute must be an object");
      }

      if (!Object.keys(attribute).length) {
        throw new TypeError("Attributes must contain at least one key");
      }

      if (Object.keys(attribute).length !== keys.length) {
        throw new TypeError("Attributes must contain the same keys");
      }

      if (Object.keys(attribute).some((key) => !keys.includes(key))) {
        throw new TypeError("Attributes must contain the same keys");
      }

      if (keys.some((key) => !Object.keys(attribute).includes(key))) {
        throw new TypeError("Attributes must contain the same keys");
      }
    }
  }
}
