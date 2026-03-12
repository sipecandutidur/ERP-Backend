import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

async function main() {
  const project = await prisma.project.findFirst({
    orderBy: { createdAt: 'desc' },
    include: {
      rab: { include: { items: true } },
      quotations: { include: { items: true } }
    }
  });

  console.log('Project ID:', project?.id);
  console.log('Quotations linked:', project?.quotations.length);
  if (project?.quotations.length) {
    console.log('Quotation 0 items length:', project.quotations[0].items.length);
  }
  console.log('RAB Items length:', project?.rab?.items?.length);
  if (project?.rab?.items?.length) {
    console.log('RAB Item 0:', project.rab.items[0]);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
