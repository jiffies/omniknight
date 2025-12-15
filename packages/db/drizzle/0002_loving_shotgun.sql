DROP TABLE `messages`;--> statement-breakpoint
DROP INDEX IF EXISTS `filter_rules_name_unique`;--> statement-breakpoint
CREATE INDEX `filter_rules_name_unique` ON `filter_rules` (`name`);--> statement-breakpoint
ALTER TABLE `groups` ADD `topic_id` integer;--> statement-breakpoint
ALTER TABLE `groups` ADD `parent_group_id` integer;--> statement-breakpoint
ALTER TABLE `groups` ADD `is_topic` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `summary_jobs` ADD `task_type` text DEFAULT 'manual' NOT NULL;