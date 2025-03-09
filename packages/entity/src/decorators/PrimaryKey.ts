/* eslint-disable @typescript-eslint/no-unsafe-function-type */

import { globalEntityMetadata } from "../utils";

export function PrimaryKey(columns: Array<string>): ClassDecorator;
export function PrimaryKey(): PropertyDecorator;
export function PrimaryKey(arg1?: any): ClassDecorator | PropertyDecorator {
  return function (target, key) {
    if (key) {
      globalEntityMetadata.addPrimaryKey({
        target: target.constructor,
        key: key.toString(),
      });
    } else {
      const columns = arg1 as Array<string>;
      for (const key of columns) {
        globalEntityMetadata.addPrimaryKey({
          target: target as Function,
          key,
        });
      }
    }
  };
}
