CREATE TABLE `portfolio_meta` (
	`id` integer PRIMARY KEY NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`token` text DEFAULT '' NOT NULL,
	`updated_at` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `portfolio_sites` (
	`site_id` text PRIMARY KEY NOT NULL,
	`body` text NOT NULL
);
