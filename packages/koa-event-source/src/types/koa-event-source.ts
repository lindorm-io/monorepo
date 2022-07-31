import {
  AppAdmin,
  AppPublishOptions,
  AppPublishResult,
  AppRepositories,
} from "@lindorm-io/event-source";

export interface KoaEventSource {
  publish(options: AppPublishOptions): Promise<AppPublishResult>;
  admin: AppAdmin;
  repositories: AppRepositories;
}
2;
