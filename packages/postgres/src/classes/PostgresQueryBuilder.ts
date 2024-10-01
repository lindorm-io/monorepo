import { isArray, isNumber, isObject, isString } from "@lindorm/is";
import { DeepPartial, Dict } from "@lindorm/types";
import { QueryConfig } from "pg";
import { IPostgresQueryBuilder } from "../interfaces";
import { InsertOptions, PostgresQueryBuilderOptions, SelectOptions } from "../types";

export class PostgresQueryBuilder<T extends Dict> implements IPostgresQueryBuilder<T> {
  private readonly table: string;

  public constructor(options: PostgresQueryBuilderOptions) {
    this.validateTableName(options.table);
    this.table = options.table;
  }

  // public

  public insert(attribute: T, options?: InsertOptions<T>): QueryConfig {
    return this.handleInsert([attribute], options);
  }

  public insertMany(attributes: Array<T>, options?: InsertOptions<T>): QueryConfig {
    return this.handleInsert(attributes, options);
  }

  public select(criteria: DeepPartial<T>, options: SelectOptions<T> = {}): QueryConfig {
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

    if (options.returning) {
      text += " RETURNING ";

      if (isString(options.returning)) {
        text += options.returning + ",";
      } else if (isArray(options.returning)) {
        for (const item of options.returning) {
          if (!isString(item)) {
            throw new TypeError("Returns must be an array of strings");
          }
          text += item + ",";
        }
      }

      text = text.slice(0, -1);
    }

    return { text, values };
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
