import { isObject } from "@lindorm/is";
import { Dict } from "@lindorm/types";
import { Criteria, QueryOperator } from "../../types";
import { HandlerResult } from "../../types/private";
import { quotation } from "./quotation";

export const handleWhere = <T extends Dict>(criteria: Criteria<T>): HandlerResult => {
  if (!Object.keys(criteria).length) return { text: "", values: [] };

  let text = " WHERE ";
  const values: Array<any> = [];

  for (const [key, condition] of Object.entries(criteria)) {
    if (condition === undefined) continue; // Skip undefined values

    if (isObject(condition)) {
      const queryOps = condition as QueryOperator<any>;

      if (queryOps.$eq === null) {
        text += quotation(key) + " IS NULL AND ";
      } else if (queryOps.$eq !== undefined) {
        text += quotation(key) + " = ? AND ";
        values.push(queryOps.$eq);
      }

      if (queryOps.$neq === null) {
        text += quotation(key) + " IS NOT NULL AND ";
      } else if (queryOps.$neq !== undefined) {
        text += quotation(key) + " <> ? AND ";
        values.push(queryOps.$neq);
      }

      if (queryOps.$gt !== undefined) {
        text += quotation(key) + " > ? AND ";
        values.push(queryOps.$gt);
      }
      if (queryOps.$gte !== undefined) {
        text += quotation(key) + " >= ? AND ";
        values.push(queryOps.$gte);
      }
      if (queryOps.$lt !== undefined) {
        text += quotation(key) + " < ? AND ";
        values.push(queryOps.$lt);
      }
      if (queryOps.$lte !== undefined) {
        text += quotation(key) + " <= ? AND ";
        values.push(queryOps.$lte);
      }
      if (queryOps.$like !== undefined) {
        text += quotation(key) + " LIKE ? AND ";
        values.push(queryOps.$like);
      }
      if (queryOps.$ilike !== undefined) {
        text += quotation(key) + " ILIKE ? AND ";
        values.push(queryOps.$ilike);
      }
      if (queryOps.$in !== undefined) {
        text +=
          quotation(key) + " IN (" + queryOps.$in.map(() => "?").join(", ") + ") AND ";
        values.push(...queryOps.$in);
      }
      if (queryOps.$nin !== undefined) {
        text +=
          quotation(key) +
          " NOT IN (" +
          queryOps.$nin.map(() => "?").join(", ") +
          ") AND ";
        values.push(...queryOps.$nin);
      }
      if (queryOps.$between !== undefined) {
        text += quotation(key) + " BETWEEN ? AND ? AND ";
        values.push(queryOps.$between[0], queryOps.$between[1]);
      }
    } else {
      if (condition === null) {
        text += quotation(key) + " IS NULL AND ";
      } else {
        text += quotation(key) + " = ? AND ";
        values.push(condition);
      }
    }
  }

  text = text.slice(0, -5);

  return { text, values };
};
