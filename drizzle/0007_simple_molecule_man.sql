DROP INDEX `tags_name_unique`;--> statement-breakpoint
CREATE UNIQUE INDEX `tags_name_type_unique` ON `tags` (`name`,`type`);