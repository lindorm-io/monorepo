import { globalEntityMetadata } from "../utils";

export function UpdateDateColumn(): PropertyDecorator {
  return function (target, key) {
    globalEntityMetadata.addColumn({
      target: target.constructor,
      key: key.toString(),
      decorator: "UpdateDateColumn",
      enum: null,
      fallback: () => new Date(),
      max: null,
      min: null,
      nullable: false,
      optional: false,
      readonly: true,
      schema: null,
      type: "date",
    });
  };
}
