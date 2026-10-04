CREATE TABLE `block_labels` (
	`block_id` text NOT NULL,
	`label_id` text NOT NULL,
	`attached_at` text NOT NULL,
	PRIMARY KEY(`block_id`, `label_id`),
	FOREIGN KEY (`block_id`) REFERENCES `blocks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`label_id`) REFERENCES `labels`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `blocks` (
	`id` text PRIMARY KEY NOT NULL,
	`reviewed_at` text,
	`completed_at` text,
	`deleted_at` text,
	`delete_reason` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `captures` (
	`id` text PRIMARY KEY NOT NULL,
	`method` text NOT NULL,
	`source_app` text,
	`status` text NOT NULL,
	`error_code` text,
	`captured_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `elements` (
	`id` text PRIMARY KEY NOT NULL,
	`block_id` text NOT NULL,
	`type` text NOT NULL,
	`value` text,
	`date_value` text,
	`time_value` text,
	`raw_text` text,
	`needs_confirm` integer DEFAULT false NOT NULL,
	`capture_id` text,
	`order_index` integer NOT NULL,
	`deleted_at` text,
	`delete_reason` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`block_id`) REFERENCES `blocks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`capture_id`) REFERENCES `captures`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `elements_block_id_idx` ON `elements` (`block_id`);--> statement-breakpoint
CREATE INDEX `elements_date_value_idx` ON `elements` (`date_value`);--> statement-breakpoint
CREATE INDEX `elements_capture_id_idx` ON `elements` (`capture_id`);--> statement-breakpoint
CREATE TABLE `history` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`action` text NOT NULL,
	`before` text,
	`after` text,
	`occurred_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `history_entity_idx` ON `history` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE TABLE `labels` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text,
	`name` text NOT NULL,
	`is_system` integer DEFAULT false NOT NULL,
	`group_key` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `labels_key_unique` ON `labels` (`key`);