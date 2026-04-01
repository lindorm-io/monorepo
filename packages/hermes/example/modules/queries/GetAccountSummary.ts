import { Query } from "@lindorm/hermes";

@Query()
export class GetAccountSummary {
  public constructor(public readonly accountId: string) {}
}
