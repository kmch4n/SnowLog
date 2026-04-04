CREATE TABLE `diary_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date_key` text NOT NULL,
	`ski_resort_name` text,
	`weather` text,
	`snow_condition` text,
	`impressions` text DEFAULT '' NOT NULL,
	`temperature` integer,
	`companions` text,
	`fatigue_level` integer,
	`expenses` integer,
	`number_of_runs` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `diary_entries_date_key_unique` ON `diary_entries` (`date_key`);