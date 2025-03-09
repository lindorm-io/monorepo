import { randomUUID } from "crypto";
import { globalEntityMetadata } from "../utils";

export function PrimaryKeyColumn(): PropertyDecorator {
  return function (target, key) {
    globalEntityMetadata.addColumn({
      target: target.constructor,
      key: key.toString(),
      decorator: "PrimaryKeyColumn",
      enum: null,
      fallback: () => randomUUID(),
      max: null,
      min: null,
      nullable: false,
      optional: false,
      readonly: true,
      schema: null,
      type: "uuid",
    });
    globalEntityMetadata.addPrimaryKey({
      target: target.constructor,
      key: key.toString(),
    });
  };
}
