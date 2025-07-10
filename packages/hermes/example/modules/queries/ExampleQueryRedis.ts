import { Query } from "../../../src";

@Query()
export class ExampleRedisQuery {
  public constructor(public readonly id: string) {}
}
