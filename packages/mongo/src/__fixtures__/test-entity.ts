import { MongoEntity } from "../classes";

export type TestEntityOptions = {
  email?: string;
  name: string;
};

export class TestEntity extends MongoEntity {
  public email!: string | null;
  public name!: string;
}
