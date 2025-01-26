import { MongoEntityBase } from "../classes";

export type TestEntityOptions = {
  email?: string;
  name: string;
};

export class TestEntity extends MongoEntityBase {
  public email!: string | null;
  public name!: string;
}
