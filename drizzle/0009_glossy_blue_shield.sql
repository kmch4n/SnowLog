CREATE TABLE `video_transfer_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`asset_id` text NOT NULL,
	`kind` text NOT NULL,
	`video_id` text NOT NULL,
	`state` text NOT NULL,
	`payload_json` text NOT NULL,
	`error_code` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `video_transfer_jobs_asset_id_unique` ON `video_transfer_jobs` (`asset_id`);