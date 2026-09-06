import { PrismaClient } from '@prisma/client';
import { backfillImages, seedIfEmpty } from '../src/seed/seed';

const prisma = new PrismaClient();

async function main() {
  const result = await seedIfEmpty(prisma);
  await backfillImages(prisma);
  console.log('seed', result);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
