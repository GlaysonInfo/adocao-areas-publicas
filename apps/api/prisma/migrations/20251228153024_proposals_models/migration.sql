-- CreateEnum
CREATE TYPE "KanbanColuna" AS ENUM ('protocolo', 'analise_semad', 'analise_ecos', 'ajustes', 'decisao', 'termo_assinado', 'indeferida');

-- CreateEnum
CREATE TYPE "ClosedStatus" AS ENUM ('approved', 'rejected');

-- CreateTable
CREATE TABLE "proposals" (
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

    CONSTRAINT "proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposal_events" (
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

    CONSTRAINT "proposal_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposal_documentos" (
    "id" TEXT NOT NULL,
    "proposal_id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_size" INTEGER,
    "mime_type" TEXT,
    "last_modified" BIGINT,

    CONSTRAINT "proposal_documentos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "proposals_codigo_protocolo_key" ON "proposals"("codigo_protocolo");

-- CreateIndex
CREATE INDEX "proposals_area_id_idx" ON "proposals"("area_id");

-- CreateIndex
CREATE INDEX "proposals_owner_role_idx" ON "proposals"("owner_role");

-- CreateIndex
CREATE INDEX "proposals_kanban_coluna_idx" ON "proposals"("kanban_coluna");

-- CreateIndex
CREATE INDEX "proposal_events_proposal_id_at_idx" ON "proposal_events"("proposal_id", "at");

-- CreateIndex
CREATE INDEX "proposal_events_type_at_idx" ON "proposal_events"("type", "at");

-- CreateIndex
CREATE INDEX "proposal_events_actor_role_at_idx" ON "proposal_events"("actor_role", "at");

-- CreateIndex
CREATE INDEX "proposal_documentos_proposal_id_idx" ON "proposal_documentos"("proposal_id");

-- CreateIndex
CREATE INDEX "proposal_documentos_tipo_idx" ON "proposal_documentos"("tipo");

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_events" ADD CONSTRAINT "proposal_events_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "proposals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_documentos" ADD CONSTRAINT "proposal_documentos_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "proposals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
