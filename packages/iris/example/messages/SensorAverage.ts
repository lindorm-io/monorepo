import { Field, Message, Namespace } from "../../src/index.js";

@Message()
@Namespace("telemetry")
export class SensorAverage {
  @Field("string") sensorId!: string;
  @Field("float") celsius!: number;
  @Field("integer") samples!: number;
}
