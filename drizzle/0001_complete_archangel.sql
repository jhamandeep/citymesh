CREATE TABLE `portfolio_revision_sites` (
	`version` integer NOT NULL,
	`site_id` text NOT NULL,
	`body` text NOT NULL,
	PRIMARY KEY(`version`, `site_id`)
);
--> statement-breakpoint
CREATE TABLE `portfolio_snapshots` (
	`version` integer PRIMARY KEY NOT NULL,
	`updated_at` text NOT NULL
);
