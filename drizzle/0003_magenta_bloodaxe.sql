CREATE TABLE `auction_rounds` (
	`id` varchar(64) NOT NULL,
	`sequenceIndex` int NOT NULL,
	`prize` decimal(12,2) NOT NULL,
	`startsAt` timestamp NOT NULL,
	`endsAt` timestamp NOT NULL,
	`status` enum('scheduled','active','finished') NOT NULL DEFAULT 'scheduled',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `auction_rounds_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `manual_bids` (
	`id` int AUTO_INCREMENT NOT NULL,
	`roundId` varchar(64) NOT NULL,
	`name` varchar(120) NOT NULL,
	`amount` decimal(12,2) NOT NULL,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `manual_bids_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `auction_rounds_status_idx` ON `auction_rounds` (`status`);--> statement-breakpoint
CREATE INDEX `auction_rounds_ends_at_idx` ON `auction_rounds` (`endsAt`);--> statement-breakpoint
CREATE INDEX `manual_bids_round_idx` ON `manual_bids` (`roundId`);--> statement-breakpoint
CREATE INDEX `manual_bids_created_at_idx` ON `manual_bids` (`createdAt`);