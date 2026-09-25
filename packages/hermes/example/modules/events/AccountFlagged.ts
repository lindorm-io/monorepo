import { Event } from "@lindorm/hermes";

@Event()
export class AccountFlagged {
  constructor(readonly reason: string) {}
}
