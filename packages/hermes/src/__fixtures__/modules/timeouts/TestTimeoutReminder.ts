import { Timeout } from "../../../decorators";

@Timeout()
export class TestTimeoutReminder {
  public constructor(public readonly data: string) {}
}
