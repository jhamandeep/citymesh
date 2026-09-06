CREATE TABLE `shared_surveys` (
	`site_id` text PRIMARY KEY NOT NULL,
	`version` integer NOT NULL,
	`object_key` text,
	`metadata` text,
	`updated_at` text NOT NULL
);
