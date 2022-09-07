import {
  EventSourceAdmin,
  EventSourceCommandOptions,
  EventSourceCommandResult,
} from "@lindorm-io/event-source";

export interface KoaEventSource<TCommand = any, TQuery = any> {
  command<TMetadata>(
    command: TCommand,
    options: EventSourceCommandOptions<TMetadata>,
  ): Promise<EventSourceCommandResult>;
  query<TResult>(query: TQuery): Promise<TResult>;

  admin: EventSourceAdmin;
}
