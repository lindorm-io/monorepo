import { Timeout } from "@lindorm/hermes";

@Timeout()
export class InactivityTimeout {
  constructor(readonly accountId: string) {}
}
