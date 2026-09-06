CREATE TABLE `inspection_photos` (
	`id` text PRIMARY KEY NOT NULL,
	`site_id` text NOT NULL,
	`object_key` text NOT NULL,
	`metadata` text NOT NULL,
	`portfolio_version` integer NOT NULL,
	`shared_at` text NOT NULL
);
