import { isObject } from "@lindorm/is";
import { Dict } from "@lindorm/types";
import { Criteria, QueryOperator } from "../../types";
import { HandlerResult } from "../../types/private";
import { quotation } from "./quotation";

// Helper function to build SQL path for JSONB or regular fields
const buildPath = (key: string, path: string[]): string => {
  if (path.length === 0) {
    // Top-level access: regular SQL column access
    return `${quotation(key)}`;
  }
  if (path.length === 1) {
    // First-level access within JSONB: use ->>
    return `${quotation(path[0])}->>'${key}'`;
  }
  // Nested JSONB access: use #>> for deep paths
  return `${quotation(path[0])} #>> '{${path.slice(1).concat(key).join(", ")}}'`;
};

// Function to handle different operators and construct WHERE clause
const processCriteria = (
  key: string,
  condition: any,
  path: Array<string> = [],
): HandlerResult => {
  let text = "";
  const values: Array<any> = [];

  const operatorPath = buildPath(key, path);

  if (
    isObject(condition) &&
    ("$eq" in condition ||
      "$neq" in condition ||
      "$gt" in condition ||
      "$gte" in condition ||
      "$lt" in condition ||
      "$lte" in condition ||
      "$like" in condition ||
      "$ilike" in condition ||
      "$in" in condition ||
      "$nin" in condition ||
      "$between" in condition)
  ) {
    const queryOps = condition as QueryOperator<any>;

    if (queryOps.$eq === null) {
      text += `${operatorPath} IS NULL AND `;
    } else if (queryOps.$eq !== undefined) {
      text += `${operatorPath} = ? AND `;
      values.push(queryOps.$eq);
    }

    if (queryOps.$neq === null) {
      text += `${operatorPath} IS NOT NULL AND `;
    } else if (queryOps.$neq !== undefined) {
      text += `${operatorPath} <> ? AND `;
      values.push(queryOps.$neq);
    }

    if (queryOps.$gt !== undefined) {
      text += `${operatorPath} > ? AND `;
      values.push(queryOps.$gt);
    }
    if (queryOps.$gte !== undefined) {
      text += `${operatorPath} >= ? AND `;
      values.push(queryOps.$gte);
    }
    if (queryOps.$lt !== undefined) {
      text += `${operatorPath} < ? AND `;
      values.push(queryOps.$lt);
    }
    if (queryOps.$lte !== undefined) {
      text += `${operatorPath} <= ? AND `;
      values.push(queryOps.$lte);
    }
    if (queryOps.$like !== undefined) {
      text += `${operatorPath} LIKE ? AND `;
      values.push(queryOps.$like);
    }
    if (queryOps.$ilike !== undefined) {
      text += `${operatorPath} ILIKE ? AND `;
      values.push(queryOps.$ilike);
    }
    if (queryOps.$in !== undefined) {
      text += `${operatorPath} IN (${queryOps.$in.map(() => "?").join(", ")}) AND `;
      values.push(...queryOps.$in);
    }
    if (queryOps.$nin !== undefined) {
      text += `${operatorPath} NOT IN (${queryOps.$nin.map(() => "?").join(", ")}) AND `;
      values.push(...queryOps.$nin);
    }
    if (queryOps.$between !== undefined) {
      text += `${operatorPath} BETWEEN ? AND ? AND `;
      values.push(queryOps.$between[0], queryOps.$between[1]);
    }
  } else {
    if (condition === null) {
      text += `${operatorPath} IS NULL AND `;
    } else {
      text += `${operatorPath} = ? AND `;
      values.push(condition);
    }
  }

  return { text, values };
};

// Recursive function to process criteria and return the WHERE clause parts
const recursiveProcess = (
  currentCriteria: any,
  path: Array<string> = [],
): HandlerResult => {
  let text = "";
  const values: Array<any> = [];

  for (const [key, condition] of Object.entries(currentCriteria)) {
    if (
      isObject(condition) &&
      !(
        "$eq" in condition ||
        "$neq" in condition ||
        "$gt" in condition ||
        "$gte" in condition ||
        "$lt" in condition ||
        "$lte" in condition ||
        "$like" in condition ||
        "$ilike" in condition ||
        "$in" in condition ||
        "$nin" in condition ||
        "$between" in condition
      )
    ) {
      // Recurse deeper into the object structure for nested fields
      const nestedResult = recursiveProcess(condition, [...path, key]);
      text += nestedResult.text;
      values.push(...nestedResult.values);
    } else {
      // Handle the current level criteria and append to query
      const result = processCriteria(key, condition, path);
      text += result.text;
      values.push(...result.values);
    }
  }

  return { text, values };
};

export const handleWhere = <T extends Dict>(criteria: Criteria<T>): HandlerResult => {
  if (!Object.keys(criteria).length) return { text: "", values: [] };

  // Call recursiveProcess to build the WHERE clause and collect values
  const { text: whereText, values } = recursiveProcess(criteria);

  // Remove trailing " AND " from the text
  const finalText = whereText.slice(0, -5); // Remove the last ' AND '

  return { text: ` WHERE ${finalText}`, values };
};
