import {
  DtoClass,
  EventSourceAdmin,
  EventSourceCommandOptions,
  EventSourceCommandResult,
  Metadata,
} from "@lindorm-io/event-source";

export interface KoaEventSource<
  TCommand extends DtoClass = DtoClass,
  TQuery extends DtoClass = DtoClass,
> {
  command<TMetadata extends Metadata = Metadata>(
    command: TCommand,
    options: EventSourceCommandOptions<TMetadata>,
  ): Promise<EventSourceCommandResult>;
  query<TResult>(query: TQuery): Promise<TResult>;

  admin: EventSourceAdmin;
}
