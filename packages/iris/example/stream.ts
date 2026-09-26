import { IrisSource } from "../src/index.js";
import { Logger } from "@lindorm/logger";
import { SensorAverage } from "./messages/SensorAverage.js";
import { SensorReading } from "./messages/SensorReading.js";

const source = new IrisSource({
  driver: "memory",
  logger: new Logger({ level: "warn", readable: true }),
  messages: [SensorAverage, SensorReading],
});

await source.connect();
await source.setup();

const pipeline = source
  .stream()
  .from(SensorReading)
  .filter((reading) => reading.celsius > -50)
  .batch(3, { timeout: 1_000 })
  .map((batch) => {
    const average = new SensorAverage();
    average.sensorId = batch[0].sensorId;
    average.celsius = batch.reduce((sum, r) => sum + r.celsius, 0) / batch.length;
    average.samples = batch.length;
    return average;
  })
  .to(SensorAverage);

// A pipeline is a live transform: nothing published before start() is replayed.
console.log("streamReplay        > ", source.capabilities.streamReplay);
console.log("streamDurableOffset > ", source.capabilities.streamDurableOffset);

await pipeline.start();

const bus = source.messageBus(SensorAverage);

await bus.subscribe({
  topic: "telemetry.SensorAverage",
  callback: async (average) => {
    console.log("averaged > ", average.sensorId, average.celsius, average.samples);
  },
});

const readings = source.publisher(SensorReading);

for (const celsius of [19.1, 19.7, 20.4]) {
  await readings.publish(readings.create({ sensorId: "sensor-1", celsius }));
}

await new Promise((resolve) => setTimeout(resolve, 2_000));

console.log("isRunning > ", pipeline.isRunning());

await pipeline.stop();
await source.drain();
await source.disconnect();
