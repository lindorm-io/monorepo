import { Timeout } from "@lindorm/hermes";

@Timeout()
export class InactivityTimeout {
  public constructor(public readonly accountId: string) {}
}
