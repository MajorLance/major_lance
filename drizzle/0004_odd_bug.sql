CREATE TABLE `winners` (
	`id` int AUTO_INCREMENT NOT NULL,
	`roundId` varchar(64) NOT NULL,
	`name` varchar(120) NOT NULL,
	`prize` decimal(12,2) NOT NULL,
	`winningBid` decimal(12,2) NOT NULL,
	`wonAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `winners_id` PRIMARY KEY(`id`),
	CONSTRAINT `winners_roundId_unique` UNIQUE(`roundId`)
);
--> statement-breakpoint
CREATE INDEX `winners_won_at_idx` ON `winners` (`wonAt`);