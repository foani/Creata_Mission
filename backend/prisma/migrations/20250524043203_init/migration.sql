-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "wallet_address" TEXT NOT NULL,
    "telegram_id" TEXT,
    "language" TEXT NOT NULL DEFAULT 'en',
    "is_wallet_verified" BOOLEAN NOT NULL DEFAULT false,
    "is_wallet_installed" BOOLEAN NOT NULL DEFAULT false,
    "score" INTEGER NOT NULL DEFAULT 0,
    "last_played_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_logs" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "game_type" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "result" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "game_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "airdrop_queue" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "reward_type" TEXT NOT NULL,
    "cta_amount" DECIMAL(20,8) NOT NULL,
    "tx_hash" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),

    CONSTRAINT "airdrop_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_users" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'admin',
    "last_login" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_wallet_address_key" ON "users"("wallet_address");

-- CreateIndex
CREATE UNIQUE INDEX "users_telegram_id_key" ON "users"("telegram_id");

-- CreateIndex
CREATE INDEX "users_is_wallet_verified_is_wallet_installed_idx" ON "users"("is_wallet_verified", "is_wallet_installed");

-- CreateIndex
CREATE INDEX "game_logs_user_id_idx" ON "game_logs"("user_id");

-- CreateIndex
CREATE INDEX "game_logs_game_type_idx" ON "game_logs"("game_type");

-- CreateIndex
CREATE INDEX "airdrop_queue_status_idx" ON "airdrop_queue"("status");

-- CreateIndex
CREATE INDEX "airdrop_queue_reward_type_idx" ON "airdrop_queue"("reward_type");

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");

-- AddForeignKey
ALTER TABLE "game_logs" ADD CONSTRAINT "game_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "airdrop_queue" ADD CONSTRAINT "airdrop_queue_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
