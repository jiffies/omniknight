CREATE TABLE `summary_jobs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`group_id` integer NOT NULL,
	`period_start` integer NOT NULL,
	`period_end` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`progress` integer DEFAULT 0 NOT NULL,
	`current_message_id` integer,
	`fetched_count` integer DEFAULT 0 NOT NULL,
	`error_message` text,
	`retry_count` integer DEFAULT 0 NOT NULL,
	`scheduled_at` integer DEFAULT (unixepoch()) NOT NULL,
	`started_at` integer,
	`completed_at` integer,
	`next_retry_at` integer,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_summary_jobs_group_status` ON `summary_jobs` (`group_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_summary_jobs_status` ON `summary_jobs` (`status`);--> statement-breakpoint
CREATE INDEX `idx_summary_jobs_scheduled` ON `summary_jobs` (`scheduled_at`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_messages` (
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
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_messages`("id", "telegram_id", "group_id", "text", "sender_id", "sender_name", "date", "is_forwarded", "has_media", "media_type", "is_filtered", "filter_reason", "included_in_summary_id", "created_at") SELECT "id", "telegram_id", "group_id", "text", "sender_id", "sender_name", "date", "is_forwarded", "has_media", "media_type", "is_filtered", "filter_reason", "included_in_summary_id", "created_at" FROM `messages`;--> statement-breakpoint
DROP TABLE `messages`;--> statement-breakpoint
ALTER TABLE `__new_messages` RENAME TO `messages`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_messages_group_date` ON `messages` (`group_id`,`date`);--> statement-breakpoint
CREATE INDEX `idx_messages_filtered` ON `messages` (`is_filtered`);--> statement-breakpoint
CREATE INDEX `idx_messages_summary` ON `messages` (`included_in_summary_id`);--> statement-breakpoint
ALTER TABLE `groups` ADD `last_synced_message_id` integer;--> statement-breakpoint
ALTER TABLE `groups` ADD `rate_limit_state` text;--> statement-breakpoint
ALTER TABLE `summaries` ADD `fetched_message_count` integer;--> statement-breakpoint
ALTER TABLE `summaries` ADD `filtered_message_count` integer;--> statement-breakpoint
ALTER TABLE `summaries` ADD `fetch_duration` integer;--> statement-breakpoint
ALTER TABLE `summaries` ADD `flood_wait_count` integer DEFAULT 0;