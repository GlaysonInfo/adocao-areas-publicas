-- CreateEnum
CREATE TYPE "AreaStatus" AS ENUM ('disponivel', 'em_adocao', 'adotada', 'indisponivel');

-- CreateEnum
CREATE TYPE "AreaTipo" AS ENUM ('area_publica', 'solicitacao_adotante', 'praca', 'parque', 'campo_futebol', 'jardim', 'canteiro', 'outro');

-- CreateTable
CREATE TABLE "areas" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" "AreaTipo" NOT NULL,
    "bairro" TEXT NOT NULL,
    "logradouro" TEXT,
    "metragem_m2" INTEGER NOT NULL,
    "status" "AreaStatus" NOT NULL DEFAULT 'disponivel',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "restricoes" TEXT,
    "geo_arquivo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "areas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "areas_codigo_key" ON "areas"("codigo");
