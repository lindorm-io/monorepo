import { Command } from "../../../decorators/index.js";

@Command()
export class TestCommandEncrypt {
  public constructor(public readonly input: string) {}
}
