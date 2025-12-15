-- Step 1: Create telegram_accounts table
CREATE TABLE `telegram_accounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`phone_number` text NOT NULL,
	`user_id` text,
	`username` text,
	`first_name` text,
	`last_name` text,
	`session_string` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`is_connected` integer DEFAULT false NOT NULL,
	`last_connected_at` integer,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `telegram_accounts_phone_number_unique` ON `telegram_accounts` (`phone_number`);--> statement-breakpoint
CREATE INDEX `idx_telegram_accounts_phone` ON `telegram_accounts` (`phone_number`);--> statement-breakpoint
CREATE INDEX `idx_telegram_accounts_active` ON `telegram_accounts` (`is_active`);
--> statement-breakpoint

-- Step 2: Migrate existing session from system_config to default account
INSERT INTO `telegram_accounts` (`phone_number`, `session_string`, `is_active`, `is_connected`, `created_at`, `updated_at`)
SELECT 'default_account', `value`, 1, 0, strftime('%s', 'now'), strftime('%s', 'now')
FROM `system_config`
WHERE `key` = 'telegram_session'
LIMIT 1;
--> statement-breakpoint

-- Step 3: Add account_id column to groups (temporarily nullable)
ALTER TABLE `groups` ADD `account_id` integer REFERENCES telegram_accounts(id) ON DELETE CASCADE;
--> statement-breakpoint

-- Step 4: Update all existing groups to link to the default account
UPDATE `groups`
SET `account_id` = (SELECT `id` FROM `telegram_accounts` LIMIT 1)
WHERE `account_id` IS NULL;
--> statement-breakpoint

-- Step 5: Create index on account_id
CREATE INDEX `idx_groups_account_id` ON `groups` (`account_id`);