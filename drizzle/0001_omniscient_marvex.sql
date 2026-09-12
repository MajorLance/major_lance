CREATE TABLE `bids` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`roundId` varchar(64) NOT NULL,
	`pixChargeId` int NOT NULL,
	`amount` decimal(12,2) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `bids_id` PRIMARY KEY(`id`),
	CONSTRAINT `bids_pixChargeId_unique` UNIQUE(`pixChargeId`),
	CONSTRAINT `bids_charge_idx` UNIQUE(`pixChargeId`)
);
--> statement-breakpoint
CREATE TABLE `pix_charges` (
	`id` int AUTO_INCREMENT NOT NULL,
	`identifier` varchar(64) NOT NULL,
	`requestKey` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`roundId` varchar(64) NOT NULL,
	`amount` decimal(12,2) NOT NULL,
	`pixCode` text NOT NULL,
	`status` enum('pending','paid','expired','failed') NOT NULL DEFAULT 'pending',
	`providerPayload` text,
	`paidAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pix_charges_id` PRIMARY KEY(`id`),
	CONSTRAINT `pix_charges_identifier_unique` UNIQUE(`identifier`),
	CONSTRAINT `pix_charges_requestKey_unique` UNIQUE(`requestKey`)
);
--> statement-breakpoint
CREATE INDEX `bids_round_idx` ON `bids` (`roundId`);--> statement-breakpoint
CREATE INDEX `bids_user_idx` ON `bids` (`userId`);--> statement-breakpoint
CREATE INDEX `pix_charges_user_idx` ON `pix_charges` (`userId`);--> statement-breakpoint
CREATE INDEX `pix_charges_status_idx` ON `pix_charges` (`status`);