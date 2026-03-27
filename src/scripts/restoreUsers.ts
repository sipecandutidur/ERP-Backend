import prisma from '../prisma';
import fs from 'fs';
import path from 'path';

async function restore() {
  const backupDir = path.join(__dirname, '../../backups');
  const files = fs.readdirSync(backupDir).filter(f => f.startsWith('backup-') && f.endsWith('.json'));
  if (files.length === 0) {
    console.log('No backup files found.');
    return;
  }
  
  const latestBackup = files.sort().reverse()[0];
  const backupPath = path.join(backupDir, latestBackup);
  console.log(`Restoring from ${backupPath}...`);
  
  const data = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
  
  // Restore Roles first
  if (data.role) {
    for (const r of data.role) {
      await (prisma as any).role.upsert({
        where: { id: r.id },
        update: r,
        create: r,
      });
    }
    console.log(`Restored ${data.role.length} roles.`);
  }

  // Restore Users
  if (data.user) {
    for (const u of data.user) {
      await (prisma as any).user.upsert({
        where: { id: u.id },
        update: u,
        create: u,
      });
    }
    console.log(`Restored ${data.user.length} users.`);
  }

  console.log('Restore complete.');
  await prisma.$disconnect();
}

restore().catch(e => {
  console.error(e);
  process.exit(1);
});
