import { Query } from "@lindorm/hermes";

@Query()
export class GetAccountSummary {
  constructor(readonly accountId: string) {}
}
