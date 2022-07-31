import { EventAttributes, EventStoreAttributes } from "../types";
import { addMilliseconds, addSeconds } from "date-fns";
import { randomUUID } from "crypto";

const randomNumber = (max: number = 10): number => Math.floor(Math.random() * max) + 1;

export const generateTestEventAttribute = ({
  amount,
  causationId,
  timestamp,
}: {
  amount: number;
  causationId: string;
  timestamp: Date;
}): Array<EventAttributes> => {
  const array: Array<EventAttributes> = [];

  for (let i = 1; i <= amount; i++) {
    array.push({
      id: randomUUID(),
      name: `event_name`,
      causationId,
      correlationId: randomUUID(),
      data: { event: true },
      timestamp,
    });
  }

  return array;
};

export const generateTestEventStoreAttributes = (amount: number): Array<EventStoreAttributes> => {
  let date = new Date("2010-01-01T08:00:00.000Z");

  const array: Array<EventStoreAttributes> = [];

  for (let i = 1; i <= amount; i++) {
    const causationId = randomUUID();
    const timestamp = addMilliseconds(addSeconds(date, randomNumber(100)), randomNumber(999));

    array.push({
      id: randomUUID(),
      name: "aggregate_name",
      context: "default",
      causationId,
      events: generateTestEventAttribute({ amount: randomNumber(3), causationId, timestamp }),
      loadEvents: 0,
      revision: null,
      timestamp,
    });

    date = timestamp;
  }

  return array;
};
