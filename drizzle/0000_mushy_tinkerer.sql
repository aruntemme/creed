CREATE TABLE `accounts` (
	`userId` text NOT NULL,
	`type` text NOT NULL,
	`provider` text NOT NULL,
	`providerAccountId` text NOT NULL,
	`refresh_token` text,
	`access_token` text,
	`expires_at` integer,
	`token_type` text,
	`scope` text,
	`id_token` text,
	`session_state` text,
	PRIMARY KEY(`provider`, `providerAccountId`),
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `accounts_user_idx` ON `accounts` (`userId`);--> statement-breakpoint
CREATE TABLE `creed_activity` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`proposal_id` text,
	`section_id` text NOT NULL,
	`section_name` text NOT NULL,
	`accent` text NOT NULL,
	`actor` text NOT NULL,
	`actor_type` text NOT NULL,
	`summary` text NOT NULL,
	`status` text NOT NULL,
	`change_type` text NOT NULL,
	`reason` text NOT NULL,
	`impact` text NOT NULL,
	`confidence` text NOT NULL,
	`before_text` text,
	`after_text` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`proposal_id`) REFERENCES `creed_proposals`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `creed_activity_user_created_idx` ON `creed_activity` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `creed_ai_settings` (
	`user_id` text PRIMARY KEY NOT NULL,
	`provider` text DEFAULT 'openrouter' NOT NULL,
	`selected_model_id` text NOT NULL,
	`encrypted_api_key` text,
	`api_key_last_four` text,
	`key_status` text DEFAULT 'missing' NOT NULL,
	`ai_mode` text DEFAULT 'credits' NOT NULL,
	`last_validated_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `creed_ai_usage` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`feature` text NOT NULL,
	`provider` text DEFAULT 'openrouter' NOT NULL,
	`model_id` text NOT NULL,
	`model_quality` text NOT NULL,
	`input_tokens` integer DEFAULT 0 NOT NULL,
	`output_tokens` integer DEFAULT 0 NOT NULL,
	`estimated_cost_usd` real DEFAULT 0 NOT NULL,
	`ai_mode` text DEFAULT 'byok' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `creed_ai_usage_user_created_idx` ON `creed_ai_usage` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `creed_audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`action` text NOT NULL,
	`metadata` text DEFAULT '{}' NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `creed_audit_log_user_id_created_at_idx` ON `creed_audit_log` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `creed_audit_log_action_created_at_idx` ON `creed_audit_log` (`action`,`created_at`);--> statement-breakpoint
CREATE TABLE `creed_connections` (
	`user_id` text NOT NULL,
	`connection_id` text NOT NULL,
	`status` text DEFAULT 'not-connected' NOT NULL,
	`last_seen_at` text,
	`last_agent_name` text,
	`observed_via` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `connection_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `creed_connections_user_updated_idx` ON `creed_connections` (`user_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `creed_credit_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`amount_micro_usd` integer NOT NULL,
	`balance_after_micro_usd` integer NOT NULL,
	`feature` text,
	`model_id` text,
	`stripe_payment_intent_id` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `creed_credit_transactions_stripe_payment_intent_id_unique` ON `creed_credit_transactions` (`stripe_payment_intent_id`);--> statement-breakpoint
CREATE INDEX `creed_credit_transactions_user_created_idx` ON `creed_credit_transactions` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `creed_credits` (
	`user_id` text PRIMARY KEY NOT NULL,
	`balance_micro_usd` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `creed_entitlements` (
	`user_id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`plan` text DEFAULT 'personal' NOT NULL,
	`billing_mode` text DEFAULT 'lifetime' NOT NULL,
	`stripe_customer_id` text,
	`stripe_session_id` text NOT NULL,
	`stripe_subscription_id` text,
	`stripe_payment_intent_id` text,
	`stripe_price_id` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`currency` text DEFAULT 'usd' NOT NULL,
	`status` text DEFAULT 'paid' NOT NULL,
	`current_period_end` text,
	`cancel_at_period_end` integer DEFAULT false NOT NULL,
	`paid_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `creed_entitlements_stripe_session_id_unique` ON `creed_entitlements` (`stripe_session_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `creed_entitlements_subscription_id_key` ON `creed_entitlements` (`stripe_subscription_id`) WHERE "creed_entitlements"."stripe_subscription_id" is not null;--> statement-breakpoint
CREATE INDEX `creed_entitlements_customer_id_idx` ON `creed_entitlements` (`stripe_customer_id`) WHERE "creed_entitlements"."stripe_customer_id" is not null;--> statement-breakpoint
CREATE TABLE `creed_integrations` (
	`user_id` text NOT NULL,
	`provider` text NOT NULL,
	`status` text DEFAULT 'connected' NOT NULL,
	`provider_account_id` text,
	`provider_login` text,
	`access_token` text,
	`refresh_token` text,
	`token_expires_at` text,
	`encrypted_access_token` text,
	`encrypted_refresh_token` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `provider`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `creed_integrations_user_provider_idx` ON `creed_integrations` (`user_id`,`provider`);--> statement-breakpoint
CREATE TABLE `creed_mcp_clients` (
	`user_id` text NOT NULL,
	`client_id` text NOT NULL,
	`client_name` text NOT NULL,
	`last_seen_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `client_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `creed_mcp_clients_user_last_seen_idx` ON `creed_mcp_clients` (`user_id`,`last_seen_at`);--> statement-breakpoint
CREATE TABLE `creed_mcp_read_events` (
	`user_id` text NOT NULL,
	`client_id` text NOT NULL,
	`day` text NOT NULL,
	`read_count` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `client_id`, `day`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `creed_mcp_read_events_user_day_idx` ON `creed_mcp_read_events` (`user_id`,`day`);--> statement-breakpoint
CREATE TABLE `creed_proposals` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`section_id` text NOT NULL,
	`section_name` text NOT NULL,
	`accent` text NOT NULL,
	`agent_name` text NOT NULL,
	`change_type` text NOT NULL,
	`reason` text NOT NULL,
	`impact` text NOT NULL,
	`confidence` text NOT NULL,
	`draft` text DEFAULT '{}' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`base_revision` integer,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `creed_proposals_user_created_idx` ON `creed_proposals` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `creed_quality_reports` (
	`user_id` text PRIMARY KEY NOT NULL,
	`content_hash` text NOT NULL,
	`model_id` text NOT NULL,
	`report` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `creed_quality_reports_user_hash_idx` ON `creed_quality_reports` (`user_id`,`content_hash`);--> statement-breakpoint
CREATE TABLE `creed_sections` (
	`user_id` text NOT NULL,
	`section_id` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`accent` text NOT NULL,
	`payload` text DEFAULT '{}' NOT NULL,
	`last_edited_by` text NOT NULL,
	`last_edited_type` text NOT NULL,
	`last_edited_at` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`agent_writable` integer DEFAULT false NOT NULL,
	`template` text DEFAULT 'freeform' NOT NULL,
	`agent_permission` text DEFAULT 'propose' NOT NULL,
	`archived_at` text,
	PRIMARY KEY(`user_id`, `section_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `creed_sections_user_position_idx` ON `creed_sections` (`user_id`,`position`);--> statement-breakpoint
CREATE INDEX `creed_sections_template_idx` ON `creed_sections` (`template`);--> statement-breakpoint
CREATE TABLE `creed_tokens` (
	`user_id` text PRIMARY KEY NOT NULL,
	`read_token` text,
	`proposal_token` text,
	`direct_edit_token` text,
	`read_token_hash` text,
	`proposal_token_hash` text,
	`direct_edit_token_hash` text,
	`encrypted_read_token` text,
	`encrypted_proposal_token` text,
	`encrypted_direct_edit_token` text,
	`require_approval` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `creed_tokens_read_token_hash_idx` ON `creed_tokens` (`read_token_hash`) WHERE "creed_tokens"."read_token_hash" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX `creed_tokens_proposal_token_hash_idx` ON `creed_tokens` (`proposal_token_hash`) WHERE "creed_tokens"."proposal_token_hash" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX `creed_tokens_direct_edit_token_hash_idx` ON `creed_tokens` (`direct_edit_token_hash`) WHERE "creed_tokens"."direct_edit_token_hash" is not null;--> statement-breakpoint
CREATE TABLE `creed_version_control` (
	`user_id` text PRIMARY KEY NOT NULL,
	`provider` text DEFAULT 'github' NOT NULL,
	`repo_owner` text,
	`repo_name` text,
	`branch` text,
	`path` text DEFAULT 'creed.md' NOT NULL,
	`last_remote_sha` text,
	`last_remote_message` text,
	`last_remote_committed_at` text,
	`last_synced_content_hash` text,
	`sync_status` text DEFAULT 'not-configured' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `oauth_authorization_codes` (
	`code_hash` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`user_id` text NOT NULL,
	`redirect_uri` text NOT NULL,
	`code_challenge` text NOT NULL,
	`scope` text DEFAULT 'read propose' NOT NULL,
	`expires_at` text NOT NULL,
	`used_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `oauth_authorization_codes_user_idx` ON `oauth_authorization_codes` (`user_id`);--> statement-breakpoint
CREATE TABLE `oauth_clients` (
	`client_id` text PRIMARY KEY NOT NULL,
	`client_name` text DEFAULT 'MCP Client' NOT NULL,
	`redirect_uris` text DEFAULT '[]' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `oauth_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`access_token_hash` text NOT NULL,
	`refresh_token_hash` text NOT NULL,
	`encrypted_access_token` text NOT NULL,
	`encrypted_refresh_token` text NOT NULL,
	`client_id` text NOT NULL,
	`user_id` text NOT NULL,
	`scope` text DEFAULT 'read propose' NOT NULL,
	`access_expires_at` text NOT NULL,
	`refresh_expires_at` text NOT NULL,
	`revoked_at` text,
	`last_used_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `oauth_tokens_access_hash_idx` ON `oauth_tokens` (`access_token_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `oauth_tokens_refresh_hash_idx` ON `oauth_tokens` (`refresh_token_hash`);--> statement-breakpoint
CREATE INDEX `oauth_tokens_user_client_idx` ON `oauth_tokens` (`user_id`,`client_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`sessionToken` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`expires` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`email` text,
	`emailVerified` integer,
	`image` text,
	`passwordHash` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `verificationToken` (
	`identifier` text NOT NULL,
	`token` text NOT NULL,
	`expires` integer NOT NULL,
	PRIMARY KEY(`identifier`, `token`)
);
