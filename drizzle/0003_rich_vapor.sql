CREATE TABLE `favorite_resorts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `favorite_resorts_name_unique` ON `favorite_resorts` (`name`);