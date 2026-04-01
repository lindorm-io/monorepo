import { Command } from "@lindorm/hermes";

@Command()
export class FlagAccount {
  public constructor(public readonly reason: string) {}
}
