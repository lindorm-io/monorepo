import { MongoEntityBase } from "../classes";

export type TestEntityOptions = {
  email?: string;
  name: string;
};

export class TestEntity extends MongoEntityBase {
  public email: string | null;
  public name: string;

  public constructor(options: TestEntityOptions) {
    super();

    this.email = options.email ?? null;
    this.name = options.name;
  }
}
