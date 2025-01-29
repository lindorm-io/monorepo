import { MnemosEntity } from "../classes";

export type TestEntityOptions = {
  email?: string;
  name: string;
};

export class TestEntity extends MnemosEntity {
  public email!: string | null;
  public name!: string;
}
