import { globalEntityMetadata } from "../utils";

export function ScopeColumn(): PropertyDecorator {
  return function (target, key) {
    globalEntityMetadata.addColumn({
      target: target.constructor,
      key: key.toString(),
      decorator: "ScopeColumn",
      enum: null,
      fallback: null,
      max: null,
      min: 1,
      nullable: false,
      optional: false,
      readonly: true,
      schema: null,
      type: "string",
    });
  };
}
