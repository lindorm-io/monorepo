import Joi from "joi";
import { LindormError } from "@lindorm-io/errors";
import { randomNumber } from "@lindorm-io/core";
import { includes, remove } from "lodash";
import {
  EntityAttributes,
  EntityKeys,
  JOI_ENTITY_BASE,
  LindormEntity,
  Optional,
} from "@lindorm-io/entity";

export interface DisplayNameAttributes extends EntityAttributes {
  name: string;
  numbers: Array<number>;
}

export type DisplayNameOptions = Optional<DisplayNameAttributes, EntityKeys | "numbers">;

const schema = Joi.object<DisplayNameAttributes>({
  ...JOI_ENTITY_BASE,

  name: Joi.string().required(),
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
    if (includes(this.numbers, number)) {
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
    return includes(this.numbers, number);
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
