import { randomUUID } from "crypto";
import { globalEntityMetadata } from "../utils";

export function VersionKeyColumn(): PropertyDecorator {
  return (target, key) => {
    globalEntityMetadata.addColumn({
      target: target.constructor,
      key: key.toString(),
      decorator: "VersionKeyColumn",
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
