CREATE TABLE `customer_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`fullName` varchar(120) NOT NULL,
	`whatsapp` varchar(30) NOT NULL,
	`pixKeyType` enum('cpf','cnpj','email','phone','random') NOT NULL,
	`pixKey` varchar(160) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customer_profiles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `customer_profiles_created_at_idx` ON `customer_profiles` (`createdAt`);