import { Query } from "../../../decorators";

@Query()
export class TestRedisQuery {
  public constructor(public readonly id: string) {}
}
