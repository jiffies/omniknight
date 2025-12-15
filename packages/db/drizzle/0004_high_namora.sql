DROP INDEX IF EXISTS `groups_telegram_id_unique`;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_groups_telegram_topic_unique` ON `groups` (`telegram_id`,`topic_id`);