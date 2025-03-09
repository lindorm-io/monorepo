import { globalEntityMetadata } from "../utils";

export function VersionColumn(): PropertyDecorator {
  return function (target, key) {
    globalEntityMetadata.addColumn({
      target: target.constructor,
      key: key.toString(),
      decorator: "VersionColumn",
      enum: null,
      fallback: 0,
      max: null,
      min: 0,
      nullable: false,
      optional: false,
      readonly: true,
      schema: null,
      type: "integer",
    });
  };
}
