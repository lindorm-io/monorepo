import { Timeout } from "../../../decorators/index.js";

@Timeout()
export class TestTimeoutReminder {
  public constructor(public readonly data: string) {}
}
