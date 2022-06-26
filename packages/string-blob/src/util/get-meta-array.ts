import { getMetaObject } from "./get-meta-object";
import { getMetaType } from "./get-meta-type";
import { isArray } from "lodash";
import { isObjectStrict } from "@lindorm-io/core";

export const getMetaArray = (input: Array<any>): Array<string> => {
  const result: Array<any> = [];

  for (const value of input) {
    if (isObjectStrict(value)) {
      result.push(getMetaObject(value));
    } else if (isArray(value)) {
      result.push(getMetaArray(value));
    } else {
      result.push(getMetaType(value));
    }
  }

  return result;
};
