import type { IProteusRepository } from "@lindorm/proteus";
import type { AggregateIdentifier } from "../../types/index.js";
import type { EventRecord } from "../entities/index.js";

export const findEvents = async (
  repo: IProteusRepository<EventRecord>,
  identifier: AggregateIdentifier,
): Promise<Array<EventRecord>> =>
  repo.find(
    {
      aggregateId: identifier.id,
      aggregateName: identifier.name,
      aggregateNamespace: identifier.namespace,
    },
    { order: { expectedEvents: "ASC" } },
  );

export const insertEvents = async (
  repo: IProteusRepository<EventRecord>,
  events: Array<EventRecord>,
): Promise<Array<EventRecord>> => repo.insert(events);

export const countEvents = async (
  repo: IProteusRepository<EventRecord>,
  identifier: AggregateIdentifier,
): Promise<number> =>
  repo.count({
    aggregateId: identifier.id,
    aggregateName: identifier.name,
    aggregateNamespace: identifier.namespace,
  });
