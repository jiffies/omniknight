CREATE TABLE `groups` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`telegram_id` text NOT NULL,
	`title` text NOT NULL,
	`username` text,
	`type` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`summary_enabled` integer DEFAULT true NOT NULL,
	`summary_interval` integer DEFAULT 6 NOT NULL,
	`min_messages_for_summary` integer DEFAULT 20 NOT NULL,
	`last_message_id` integer,
	`last_summary_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `groups_telegram_id_unique` ON `groups` (`telegram_id`);--> statement-breakpoint
CREATE INDEX `idx_groups_telegram_id` ON `groups` (`telegram_id`);--> statement-breakpoint
CREATE INDEX `idx_groups_active` ON `groups` (`is_active`);--> statement-breakpoint
CREATE TABLE `messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`telegram_id` integer NOT NULL,
	`group_id` integer NOT NULL,
	`text` text,
	`sender_id` text NOT NULL,
	`sender_name` text,
	`date` integer NOT NULL,
	`is_forwarded` integer DEFAULT false NOT NULL,
	`has_media` integer DEFAULT false NOT NULL,
	`media_type` text,
	`is_filtered` integer DEFAULT false NOT NULL,
	`filter_reason` text,
	`included_in_summary_id` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`included_in_summary_id`) REFERENCES `summaries`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_messages_group_date` ON `messages` (`group_id`,`date`);--> statement-breakpoint
CREATE INDEX `idx_messages_filtered` ON `messages` (`is_filtered`);--> statement-breakpoint
CREATE INDEX `idx_messages_summary` ON `messages` (`included_in_summary_id`);--> statement-breakpoint
CREATE TABLE `summaries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`group_id` integer NOT NULL,
	`period_start` integer NOT NULL,
	`period_end` integer NOT NULL,
	`content` text NOT NULL,
	`title` text NOT NULL,
	`message_count` integer NOT NULL,
	`total_messages_in_period` integer NOT NULL,
	`ai_model` text NOT NULL,
	`tokens_used` integer,
	`generation_time` integer,
	`status` text DEFAULT 'completed' NOT NULL,
	`error_message` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_summaries_group_date` ON `summaries` (`group_id`,`period_end`);--> statement-breakpoint
CREATE INDEX `idx_summaries_status` ON `summaries` (`status`);--> statement-breakpoint
CREATE TABLE `filter_rules` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`config` text NOT NULL,
	`is_enabled` integer DEFAULT true NOT NULL,
	`priority` integer DEFAULT 100 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `filter_rules_name_unique` ON `filter_rules` (`name`);--> statement-breakpoint
CREATE INDEX `idx_filter_rules_enabled_priority` ON `filter_rules` (`is_enabled`,`priority`);--> statement-breakpoint
CREATE TABLE `system_config` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
