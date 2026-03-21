/*
  Warnings:

  - You are about to drop the `proposal_documentos` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `proposal_events` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `proposals` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "VistoriaFase" AS ENUM ('analise', 'vigencia');

-- CreateEnum
CREATE TYPE "VistoriaStatus" AS ENUM ('rascunho', 'agendada', 'executada', 'laudo_emitido', 'cancelada');

-- CreateEnum
CREATE TYPE "LaudoConclusao" AS ENUM ('favoravel', 'favoravel_com_ressalvas', 'desfavoravel');

-- DropForeignKey
ALTER TABLE "proposal_documentos" DROP CONSTRAINT "proposal_documentos_proposal_id_fkey";

-- DropForeignKey
ALTER TABLE "proposal_events" DROP CONSTRAINT "proposal_events_proposal_id_fkey";

-- DropForeignKey
ALTER TABLE "proposals" DROP CONSTRAINT "proposals_area_id_fkey";

-- DropTable
DROP TABLE "proposal_documentos";

-- DropTable
DROP TABLE "proposal_events";

-- DropTable
DROP TABLE "proposals";

-- CreateTable
CREATE TABLE "Proposal" (
    "id" TEXT NOT NULL,
    "codigo_protocolo" TEXT NOT NULL,
    "area_id" TEXT NOT NULL,
    "area_nome" TEXT NOT NULL,
    "descricao_plano" TEXT NOT NULL,
    "kanban_coluna" "KanbanColuna" NOT NULL DEFAULT 'protocolo',
    "owner_role" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "closed_status" "ClosedStatus",
    "closed_at" TIMESTAMP(3),

    CONSTRAINT "Proposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProposalEvent" (
    "id" TEXT NOT NULL,
    "proposal_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,
    "actor_role" TEXT NOT NULL,
    "from_coluna" "KanbanColuna",
    "to_coluna" "KanbanColuna",
    "note" TEXT,
    "decision" TEXT,
    "decision_note" TEXT,

    CONSTRAINT "ProposalEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProposalDocumento" (
    "id" TEXT NOT NULL,
    "proposal_id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_size" INTEGER,
    "mime_type" TEXT,
    "last_modified" BIGINT,

    CONSTRAINT "ProposalDocumento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vistorias" (
    "id" TEXT NOT NULL,
    "proposal_id" TEXT NOT NULL,
    "fase" "VistoriaFase" NOT NULL,
    "status" "VistoriaStatus" NOT NULL DEFAULT 'rascunho',
    "local_texto" TEXT NOT NULL,
    "geo" JSONB,
    "checklist_json" JSONB,
    "observacoes" TEXT,
    "agendada_para" TIMESTAMP(3),
    "executada_em" TIMESTAMP(3),
    "laudo_conclusao" "LaudoConclusao",
    "laudo_recomendacoes" TEXT,
    "laudo_emitido_em" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vistorias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vistoria_events" (
    "id" TEXT NOT NULL,
    "vistoria_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,
    "actor_role" TEXT NOT NULL,
    "payload" JSONB,

    CONSTRAINT "vistoria_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Proposal_codigo_protocolo_key" ON "Proposal"("codigo_protocolo");

-- CreateIndex
CREATE INDEX "Proposal_area_id_idx" ON "Proposal"("area_id");

-- CreateIndex
CREATE INDEX "Proposal_owner_role_idx" ON "Proposal"("owner_role");

-- CreateIndex
CREATE INDEX "Proposal_kanban_coluna_idx" ON "Proposal"("kanban_coluna");

-- CreateIndex
CREATE INDEX "ProposalEvent_proposal_id_at_idx" ON "ProposalEvent"("proposal_id", "at");

-- CreateIndex
CREATE INDEX "ProposalEvent_type_at_idx" ON "ProposalEvent"("type", "at");

-- CreateIndex
CREATE INDEX "ProposalEvent_actor_role_at_idx" ON "ProposalEvent"("actor_role", "at");

-- CreateIndex
CREATE INDEX "ProposalDocumento_proposal_id_idx" ON "ProposalDocumento"("proposal_id");

-- CreateIndex
CREATE INDEX "ProposalDocumento_tipo_idx" ON "ProposalDocumento"("tipo");

-- CreateIndex
CREATE INDEX "vistorias_proposal_id_idx" ON "vistorias"("proposal_id");

-- CreateIndex
CREATE INDEX "vistorias_fase_status_idx" ON "vistorias"("fase", "status");

-- CreateIndex
CREATE INDEX "vistoria_events_vistoria_id_at_idx" ON "vistoria_events"("vistoria_id", "at");

-- CreateIndex
CREATE INDEX "vistoria_events_type_at_idx" ON "vistoria_events"("type", "at");

-- CreateIndex
CREATE INDEX "vistoria_events_actor_role_at_idx" ON "vistoria_events"("actor_role", "at");

-- AddForeignKey
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalEvent" ADD CONSTRAINT "ProposalEvent_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "Proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalDocumento" ADD CONSTRAINT "ProposalDocumento_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "Proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vistorias" ADD CONSTRAINT "vistorias_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "Proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vistoria_events" ADD CONSTRAINT "vistoria_events_vistoria_id_fkey" FOREIGN KEY ("vistoria_id") REFERENCES "vistorias"("id") ON DELETE CASCADE ON UPDATE CASCADE;
