import { MnemosEntityBase } from "../classes";

export type TestEntityOptions = {
  email?: string;
  name: string;
};

export class TestEntity extends MnemosEntityBase {
  public email!: string | null;
  public name!: string;
}
