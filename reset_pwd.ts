import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash('123456', 10);
  try {
    await prisma.user.update({
      where: { email: 'admin@adinata.co' },
      data: { password: hash }
    });
    console.log('JOS');
  } catch (e) {
    console.log('NOT FOUND');
  }
}

main();
