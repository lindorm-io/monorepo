import { Command } from "../../../decorators/index.js";

@Command()
export class TestCommandDestroyNext {
  public constructor(public readonly input: string) {}
}
