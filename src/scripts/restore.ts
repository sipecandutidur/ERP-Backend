/**
 * Adinata ERP - Database Restore Script
 * 
 * Restores data from the JSON backup file into the database.
 * Run this script on the server after setting up a fresh database.
 * 
 * Usage:
 *   npx ts-node src/scripts/restore.ts
 *
 * Requirements:
 *   - DATABASE_URL in .env must be configured
 *   - Prisma migrations must be applied first: npx prisma migrate deploy
 */

import prisma from '../prisma';
import fs from 'fs';
import path from 'path';

async function restore() {
  // Find the most recent backup file
  const backupDir = path.join(__dirname, '../../backups');
  
  if (!fs.existsSync(backupDir)) {
    console.error('No backups directory found at:', backupDir);
    process.exit(1);
  }

  const files = fs.readdirSync(backupDir)
    .filter(f => f.endsWith('.json'))
    .sort()
    .reverse();

  if (files.length === 0) {
    console.error('No backup JSON files found in backups/');
    process.exit(1);
  }

  const backupFile = path.join(backupDir, files[0]);
  console.log(`🔄 Restoring from: ${backupFile}`);

  const data = JSON.parse(fs.readFileSync(backupFile, 'utf8'));

  console.log('Step 1: Restoring Roles...');
  for (const role of (data.role || [])) {
    await (prisma as any).role.upsert({
      where: { id: role.id },
      update: { name: role.name, description: role.description },
      create: { id: role.id, name: role.name, description: role.description, createdAt: new Date(role.createdAt), updatedAt: new Date(role.updatedAt) },
    });
  }
  console.log(`  ✅ ${data.role?.length || 0} roles`);

  console.log('Step 2: Restoring Users...');
  for (const user of (data.user || [])) {
    await (prisma as any).user.upsert({
      where: { id: user.id },
      update: { name: user.name, email: user.email },
      create: { id: user.id, email: user.email, password: user.password, name: user.name, roleId: user.roleId, createdAt: new Date(user.createdAt), updatedAt: new Date(user.updatedAt) },
    });
  }
  console.log(`  ✅ ${data.user?.length || 0} users`);

  console.log('Step 3: Restoring Organizations...');
  for (const org of (data.organization || [])) {
    await (prisma as any).organization.upsert({
      where: { id: org.id },
      update: { name: org.name, address: org.address, phone: org.phone, email: org.email, npwp: org.npwp, website: org.website },
      create: { ...org, createdAt: new Date(org.createdAt), updatedAt: new Date(org.updatedAt) },
    });
  }
  console.log(`  ✅ ${data.organization?.length || 0} organizations`);

  console.log('Step 4: Restoring Customers...');
  for (const c of (data.customer || [])) {
    await (prisma as any).customer.upsert({
      where: { id: c.id },
      update: { name: c.name },
      create: { ...c, createdAt: new Date(c.createdAt), updatedAt: new Date(c.updatedAt) },
    });
  }
  console.log(`  ✅ ${data.customer?.length || 0} customers`);

  console.log('Step 5: Restoring Distributors...');
  for (const d of (data.distributor || [])) {
    await (prisma as any).distributor.upsert({
      where: { id: d.id },
      update: { name: d.name },
      create: { ...d, createdAt: new Date(d.createdAt), updatedAt: new Date(d.updatedAt) },
    });
  }
  console.log(`  ✅ ${data.distributor?.length || 0} distributors`);

  console.log('Step 6: Restoring Items...');
  for (const item of (data.item || [])) {
    await (prisma as any).item.upsert({
      where: { id: item.id },
      update: { name: item.name, unit: item.unit },
      create: { ...item, createdAt: new Date(item.createdAt), updatedAt: new Date(item.updatedAt) },
    });
  }
  console.log(`  ✅ ${data.item?.length || 0} items`);

  console.log('Step 7: Restoring Item-Distributor links...');
  for (const id of (data.itemDistributor || [])) {
    await (prisma as any).itemDistributor.upsert({
      where: { id: id.id },
      update: { basePrice: id.basePrice, sellPrice: id.sellPrice },
      create: { ...id, createdAt: new Date(id.createdAt), updatedAt: new Date(id.updatedAt) },
    });
  }
  console.log(`  ✅ ${data.itemDistributor?.length || 0} item-distributor links`);

  console.log('Step 8: Restoring Projects...');
  for (const p of (data.project || [])) {
    await (prisma as any).project.upsert({
      where: { id: p.id },
      update: { name: p.name, status: p.status },
      create: { ...p, createdAt: new Date(p.createdAt), updatedAt: new Date(p.updatedAt) },
    });
  }
  console.log(`  ✅ ${data.project?.length || 0} projects`);

  console.log('\n🎉 Restore complete!');
  console.log('\n⚠️  Note: Quotations, Invoices, POs, and other transactional data');
  console.log('    were NOT restored to keep the server database clean.');
  console.log('    You can re-add them manually or extend this script.');

  await prisma.$disconnect();
}

restore().catch(e => {
  console.error('❌ Restore failed:', e);
  process.exit(1);
});
