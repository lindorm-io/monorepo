import {
  Field,
  Generated,
  IdentifierField,
  Message,
  Namespace,
} from "../../src/index.js";

@Message()
@Namespace("telemetry")
export class SensorReading {
  @IdentifierField() @Generated() id!: string;

  @Field("string") sensorId!: string;
  @Field("float") celsius!: number;
}
