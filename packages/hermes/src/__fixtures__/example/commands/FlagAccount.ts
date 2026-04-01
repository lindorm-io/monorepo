import { Command } from "../../../decorators";

@Command()
export class FlagAccount {
  public constructor(public readonly reason: string) {}
}
