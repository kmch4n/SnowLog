CREATE TABLE `tags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tags_name_unique` ON `tags` (`name`);--> statement-breakpoint
CREATE TABLE `video_tags` (
	`video_id` text NOT NULL,
	`tag_id` integer NOT NULL,
	FOREIGN KEY (`video_id`) REFERENCES `videos`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `videos` (
	`id` text PRIMARY KEY NOT NULL,
	`asset_id` text NOT NULL,
	`filename` text NOT NULL,
	`thumbnail_uri` text NOT NULL,
	`duration` integer DEFAULT 0 NOT NULL,
	`captured_at` integer NOT NULL,
	`ski_resort_name` text,
	`memo` text DEFAULT '' NOT NULL,
	`is_file_available` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `videos_asset_id_unique` ON `videos` (`asset_id`);