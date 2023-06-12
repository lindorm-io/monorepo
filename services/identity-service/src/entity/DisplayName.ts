import {
  EntityAttributes,
  EntityKeys,
  JOI_ENTITY_BASE,
  LindormEntity,
  Optional,
} from "@lindorm-io/entity";
import Joi from "joi";
import { JOI_DISPLAY_NAME_STRING } from "../constant";

export type DisplayNameAttributes = EntityAttributes & {
  name: string;
  number: number;
};

export type DisplayNameOptions = Optional<DisplayNameAttributes, EntityKeys | "number">;

const schema = Joi.object<DisplayNameAttributes>({
  ...JOI_ENTITY_BASE,

  name: JOI_DISPLAY_NAME_STRING.required(),
  number: Joi.number().required(),
});

export class DisplayName extends LindormEntity<DisplayNameAttributes> {
  public readonly name: string;
  public number: number;

  public constructor(options: DisplayNameOptions) {
    super(options);

    this.name = options.name;
    this.number = options.number || 0;
  }

  public async schemaValidation(): Promise<void> {
    await schema.validateAsync(this.toJSON());
  }

  public toJSON(): DisplayNameAttributes {
    return {
      ...this.defaultJSON(),

      name: this.name,
      number: this.number,
    };
  }
}
