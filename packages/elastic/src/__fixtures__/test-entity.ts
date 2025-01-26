import { ElasticEntityBase } from "../classes";

export type TestEntityOptions = {
  email?: string;
  name: string;
};

export class TestEntity extends ElasticEntityBase {
  public email!: string | null;
  public name!: string;
}
