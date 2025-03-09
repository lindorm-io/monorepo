import { globalEntityMetadata } from "../utils";

export function DeleteDateColumn(): PropertyDecorator {
  return function (target, key) {
    globalEntityMetadata.addColumn({
      target: target.constructor,
      key: key.toString(),
      decorator: "DeleteDateColumn",
      enum: null,
      fallback: null,
      max: null,
      min: null,
      nullable: true,
      optional: false,
      readonly: true,
      schema: null,
      type: "date",
    });
  };
}
