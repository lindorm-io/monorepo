import { Command } from "../../../decorators/index.js";

@Command()
export class TestCommandThrows {
  public constructor(public readonly input: string) {}
}
