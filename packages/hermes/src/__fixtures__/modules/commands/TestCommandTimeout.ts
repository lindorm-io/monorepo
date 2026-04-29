import { Command } from "../../../decorators/index.js";

@Command()
export class TestCommandTimeout {
  public constructor(public readonly input: string) {}
}
