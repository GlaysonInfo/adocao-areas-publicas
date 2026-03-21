// apps/api/src/workers/email_outbox_worker.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function tick() {
  const pending = await prisma.email_outbox.findMany({
    where: { status: "pending" },
    orderBy: { created_at: "asc" },
    take: 10,
  });

  for (const e of pending) {
    try {
      // STUB: aqui não envia SMTP; apenas “simula envio” e registra sent_at
      // O payload contém token e expires_at.
      console.log("[email_outbox_worker] SEND", {
        to: e.to_email,
        template: e.template,
        payload: e.payload_json,
      });

      await prisma.email_outbox.update({
        where: { id: e.id },
        data: {
          status: "sent",
          sent_at: new Date(),
          attempts: { increment: 1 },
          last_error: null,
        },
      });
    } catch (err: any) {
      await prisma.email_outbox.update({
        where: { id: e.id },
        data: {
          status: "failed",
          attempts: { increment: 1 },
          last_error: String(err?.message ?? err),
        },
      });
    }
  }
}

async function main() {
  console.log("[email_outbox_worker] started");
  // loop simples
  // eslint-disable-next-line no-constant-condition
  while (true) {
    // 2s
    // eslint-disable-next-line no-await-in-loop
    await tick();
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, 2000));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});