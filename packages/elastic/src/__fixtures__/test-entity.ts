import { ElasticEntity } from "../classes";

export type TestEntityOptions = {
  email?: string;
  name: string;
};

export class TestEntity extends ElasticEntity {
  public email!: string | null;
  public name!: string;
}
