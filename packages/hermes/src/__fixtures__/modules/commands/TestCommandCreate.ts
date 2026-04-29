import { Command } from "../../../decorators/index.js";

@Command()
export class TestCommandCreate {
  public constructor(public readonly input: string) {}
}
