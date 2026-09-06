CREATE TABLE `network_observations` (
	`entity_key` text PRIMARY KEY NOT NULL,
	`observed_at` text NOT NULL,
	`body` text NOT NULL,
	`received_at` text NOT NULL
);
