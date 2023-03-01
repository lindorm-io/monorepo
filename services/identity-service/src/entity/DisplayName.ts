import Joi from "joi";
import { JOI_DISPLAY_NAME_STRING } from "../constant";
import { LindormError, ServerError } from "@lindorm-io/errors";
import { randomNumber } from "@lindorm-io/random";
import { remove } from "lodash";
import {
  EntityAttributes,
  EntityKeys,
  JOI_ENTITY_BASE,
  LindormEntity,
  Optional,
} from "@lindorm-io/entity";

export type DisplayNameAttributes = EntityAttributes & {
  name: string;
  numbers: Array<number>;
};

export type DisplayNameOptions = Optional<DisplayNameAttributes, EntityKeys | "numbers">;

const schema = Joi.object<DisplayNameAttributes>({
  ...JOI_ENTITY_BASE,

  name: JOI_DISPLAY_NAME_STRING.required(),
  numbers: Joi.array().items(Joi.number()).required(),
});

export class DisplayName extends LindormEntity<DisplayNameAttributes> {
  public readonly name: string;
  public readonly numbers: Array<number>;

  public constructor(options: DisplayNameOptions) {
    super(options);

    this.name = options.name;
    this.numbers = options.numbers || [];
  }

  public add(number: number): void {
    if (this.numbers.includes(number)) {
      throw new LindormError("Number already exists for this DisplayName");
    }

    this.numbers.push(number);
    this.updated = new Date();
  }

  public remove(number: number): void {
    remove(this.numbers, (num) => num === number);

    this.updated = new Date();
  }

  public exists(number: number): boolean {
    return this.numbers.includes(number);
  }

  public async generateNumber(): Promise<number> {
    const maximumTries = 100;
    let currentTry = 0;

    while (currentTry < maximumTries) {
      const number = randomNumber(4);

      if (!this.exists(number)) {
        return number;
      }

      currentTry += 1;
    }

    throw new ServerError("Unable to generate number");
  }

  public async schemaValidation(): Promise<void> {
    await schema.validateAsync(this.toJSON());
  }

  public toJSON(): DisplayNameAttributes {
    return {
      ...this.defaultJSON(),

      name: this.name,
      numbers: this.numbers,
    };
  }
}
