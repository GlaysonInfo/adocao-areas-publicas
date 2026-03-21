-- AlterTable
ALTER TABLE "Proposal" ADD COLUMN     "owner_user_id" UUID;

-- AlterTable
ALTER TABLE "ProposalEvent" ADD COLUMN     "actor_user_id" UUID;

-- CreateIndex
CREATE INDEX "Proposal_owner_user_id_idx" ON "Proposal"("owner_user_id");

-- CreateIndex
CREATE INDEX "ProposalEvent_actor_user_id_at_idx" ON "ProposalEvent"("actor_user_id", "at");

-- AddForeignKey
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ProposalEvent" ADD CONSTRAINT "ProposalEvent_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE RESTRICT;
