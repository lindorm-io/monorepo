/* eslint-disable @typescript-eslint/no-wrapper-object-types */

import { Constructor, Dict } from "@lindorm/types";
import { DomainError } from "../../errors";
import {
  AggregateCommandCtx,
  AggregateErrorCtx,
  AggregateEventCtx,
  SagaEventCtx,
  SagaIdCtx,
  ViewEventCtx,
  ViewIdCtx,
  ViewQueryCtx,
} from "../handlers";
import { SagaErrorCtx } from "../handlers/saga-error-handler";
import { SagaTimeoutCtx } from "../handlers/saga-timeout-handler";
import { ViewErrorCtx } from "../handlers/view-error-handler";

type CustomPropertyDescriptor<T> = (
  target: Object,
  propertyKey: string | symbol,
  descriptor: TypedPropertyDescriptor<T>,
) => TypedPropertyDescriptor<T> | void;

// aggregate command

export type AggregateCommandCallback<C extends Constructor, S extends Dict> = (
  ctx: AggregateCommandCtx<InstanceType<C>, S>,
) => Promise<void>;

export type AggregateCommandHandlerDescriptor<
  C extends Constructor,
  S extends Dict,
> = CustomPropertyDescriptor<AggregateCommandCallback<C, S>>;

// aggregate error

export type AggregateErrorCallback<C extends Constructor<DomainError>> = (
  ctx: AggregateErrorCtx<InstanceType<C>>,
) => Promise<void>;

export type AggregateErrorHandlerDescriptor<C extends Constructor<DomainError>> =
  CustomPropertyDescriptor<AggregateErrorCallback<C>>;

// aggregate event

export type AggregateEventCallback<C extends Constructor, S extends Dict> = (
  ctx: AggregateEventCtx<InstanceType<C>, S>,
) => Promise<void>;

export type AggregateEventHandlerDescriptor<
  C extends Constructor,
  S extends Dict,
> = CustomPropertyDescriptor<AggregateEventCallback<C, S>>;

// saga error

export type SagaErrorCallback<C extends Constructor<DomainError>> = (
  ctx: SagaErrorCtx<InstanceType<C>>,
) => Promise<void>;

export type SagaErrorHandlerDescriptor<C extends Constructor<DomainError>> =
  CustomPropertyDescriptor<SagaErrorCallback<C>>;

// saga event

export type SagaEventCallback<C extends Constructor, S extends Dict> = (
  ctx: SagaEventCtx<InstanceType<C>, S>,
) => Promise<void>;

export type SagaEventHandlerDescriptor<
  C extends Constructor,
  S extends Dict,
> = CustomPropertyDescriptor<SagaEventCallback<C, S>>;

// saga id

export type SagaIdCallback<C extends Constructor> = (
  ctx: SagaIdCtx<InstanceType<C>>,
) => string;

export type SagaIdHandlerDescriptor<C extends Constructor> = CustomPropertyDescriptor<
  SagaIdCallback<C>
>;

// saga timeout

export type SagaTimeoutCallback<C extends Constructor, S extends Dict> = (
  ctx: SagaTimeoutCtx<InstanceType<C>, S>,
) => Promise<void>;

export type SagaTimeoutHandlerDescriptor<
  C extends Constructor,
  S extends Dict,
> = CustomPropertyDescriptor<SagaTimeoutCallback<C, S>>;

// view error

export type ViewErrorCallback<C extends Constructor<DomainError>> = (
  ctx: ViewErrorCtx<InstanceType<C>>,
) => Promise<void>;

export type ViewErrorHandlerDescriptor<C extends Constructor<DomainError>> =
  CustomPropertyDescriptor<ViewErrorCallback<C>>;

// view event

export type ViewEventCallback<C extends Constructor, S extends Dict> = (
  ctx: ViewEventCtx<InstanceType<C>, S>,
) => Promise<void>;

export type ViewEventHandlerDescriptor<
  C extends Constructor,
  S extends Dict,
> = CustomPropertyDescriptor<ViewEventCallback<C, S>>;

// view id

export type ViewIdCallback<C extends Constructor> = (
  ctx: ViewIdCtx<InstanceType<C>>,
) => string;

export type ViewIdHandlerDescriptor<C extends Constructor> = CustomPropertyDescriptor<
  ViewIdCallback<C>
>;

// view query

export type ViewQueryCallback<C extends Constructor, S extends Dict, R = any> = (
  ctx: ViewQueryCtx<InstanceType<C>, S>,
) => Promise<R>;

export type ViewQueryHandlerDescriptor<
  C extends Constructor,
  S extends Dict,
> = CustomPropertyDescriptor<ViewQueryCallback<C, S>>;
