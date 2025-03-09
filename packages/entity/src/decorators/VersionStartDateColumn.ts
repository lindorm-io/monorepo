import { globalEntityMetadata } from "../utils";

export function VersionStartDateColumn(): PropertyDecorator {
  return function (target, key) {
    globalEntityMetadata.addColumn({
      target: target.constructor,
      key: key.toString(),
      decorator: "VersionStartDateColumn",
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
