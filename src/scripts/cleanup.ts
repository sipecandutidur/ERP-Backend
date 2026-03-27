import prisma from '../prisma';

async function cleanup() {
  console.log('Starting database cleanup (excluding users and roles)...');
  
  // Order matters due to foreign key constraints
  const modelsToDelete = [
    'auditLog',
    'payment',
    'invoiceItem',
    'invoice',
    'deliveryNote',
    'purchaseOrderItem',
    'purchaseOrder',
    'vendorQuotationItem',
    'vendorQuotation',
    'quotationItem',
    'quotation',
    'rABItem',
    'rAB',
    'expense',
    'projectDocument',
    'project',
    'cashFlowTransaction',
    'itemDistributor',
    'item',
    'distributor',
    'organization',
    'customer',
  ];

  for (const model of modelsToDelete) {
    try {
      const count = await (prisma as any)[model].deleteMany();
      console.log(`Deleted ${count.count} records from ${model}`);
    } catch (e) {
      console.error(`Failed to delete records from ${model}:`, e);
    }
  }

  console.log('Cleanup complete.');
  await prisma.$disconnect();
}

cleanup().catch(e => {
  console.error(e);
  process.exit(1);
});
