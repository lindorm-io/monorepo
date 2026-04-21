import { Command } from "../../../decorators/index.js";

@Command()
export class FlagAccount {
  public constructor(public readonly reason: string) {}
}
