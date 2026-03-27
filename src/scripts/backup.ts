import prisma from '../prisma';
import fs from 'fs';
import path from 'path';

async function backup() {
  console.log('Starting backup...');
  const data: any = {};
  
  // List of models to backup
  const models = [
    'user', 'role', 'customer', 'organization', 'item', 'distributor', 'itemDistributor',
    'quotation', 'quotationItem', 'vendorQuotation', 'vendorQuotationItem',
    'purchaseOrder', 'purchaseOrderItem', 'deliveryNote', 'invoice', 'invoiceItem',
    'payment', 'project', 'projectDocument', 'rAB', 'rABItem', 'expense',
    'cashFlowTransaction', 'auditLog'
  ];

  for (const model of models) {
    try {
      data[model] = await (prisma as any)[model].findMany();
      console.log(`Backed up ${model}: ${data[model].length} records`);
    } catch (e) {
      console.error(`Failed to backup ${model}:`, e);
    }
  }

  const backupDir = path.join(__dirname, '../../backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupDir, `backup-${timestamp}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(data, null, 2));
  console.log(`Backup saved to ${backupPath}`);
  
  await prisma.$disconnect();
}

backup().catch(e => {
  console.error(e);
  process.exit(1);
});
