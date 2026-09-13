ALTER TABLE `videos` ADD `storage_mode` text DEFAULT 'reference' NOT NULL;--> statement-breakpoint
ALTER TABLE `videos` ADD `managed_video_path` text;--> statement-breakpoint
CREATE UNIQUE INDEX `videos_managed_video_path_unique` ON `videos` (lower("managed_video_path"));