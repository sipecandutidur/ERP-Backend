import { Request, Response } from 'express';
import prisma from '../prisma';

export const importCustomers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { data } = req.body; // Array of objects from CSV parsed by frontend

    if (!Array.isArray(data) || data.length === 0) {
      res.status(400).json({ status: 'error', message: 'No data provided for import' });
      return;
    }

    let createdCount = 0;
    let skippedCount = 0;

    for (const row of data) {
      if (!row.name) continue; // Skip if no name

      // Check if customer with same name already exists
      const existingCustomer = await prisma.customer.findFirst({
        where: { name: { equals: String(row.name), mode: 'insensitive' } }
      });

      if (existingCustomer) {
        skippedCount++;
        continue;
      }

      let organizationId = null;

      // Look up or create organization if organization name is provided
      if (row.organizationName) {
        let org = await prisma.organization.findFirst({
          where: { name: { equals: row.organizationName, mode: 'insensitive' } }
        });

        if (!org) {
          // generate org code
          const orgCount = await prisma.organization.count();
          const orgCode = `ORG-${(orgCount + 1).toString().padStart(4, '0')}`;

          org = await prisma.organization.create({
            data: {
              code: orgCode,
              name: row.organizationName,
              phone: row.phone ? String(row.phone) : null,
              email: row.email ? String(row.email) : null,
              address: row.address ? String(row.address) : null,
            }
          });
        }
        organizationId = org.id;
      }

      // Auto-generate Customer code
      const count = await prisma.customer.count();
      const code = row.code || `CUST-${(count + 1).toString().padStart(4, '0')}`;

      await prisma.customer.create({
        data: {
          code,
          name: row.name,
          email: row.email ? String(row.email) : null,
          phone: row.phone ? String(row.phone) : null,
          address: row.address ? String(row.address) : null,
          npwp: row.npwp ? String(row.npwp) : null,
          organizationId
        }
      });

      createdCount++;
    }

    const message = skippedCount > 0
      ? `Successfully imported ${createdCount} customers. Skipped ${skippedCount} duplicate(s).`
      : `Successfully imported ${createdCount} customers.`;

    res.status(200).json({ status: 'success', message });
  } catch (error: any) {
    console.error('Import Customers Error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to import customers. Check server logs.' });
  }
};

export const importDistributors = async (req: Request, res: Response): Promise<void> => {
  try {
    const { data } = req.body;

    if (!Array.isArray(data) || data.length === 0) {
      res.status(400).json({ status: 'error', message: 'No data provided for import' });
      return;
    }

    let createdCount = 0;
    let skippedCount = 0;

    for (const row of data) {
      if (!row.name) continue; // Skip if no name

      // Check if distributor with same name already exists
      const existingDistributor = await prisma.distributor.findFirst({
        where: { name: { equals: String(row.name), mode: 'insensitive' } }
      });

      if (existingDistributor) {
        skippedCount++;
        continue;
      }

      // Auto-generate Distributor code
      const count = await prisma.distributor.count();
      const code = row.code || `DIST-${(count + 1).toString().padStart(4, '0')}`;

      await prisma.distributor.create({
        data: {
          code,
          name: row.name,
          email: row.email ? String(row.email) : null,
          phone: row.phone ? String(row.phone) : null,
          address: row.address ? String(row.address) : null,
          website: row.website ? String(row.website) : null,
          district: row.district ? String(row.district) : null,
          npwp: row.npwp ? String(row.npwp) : null,
          bankName: row.bankName ? String(row.bankName) : null,
          bankAccountName: row.bankAccountName ? String(row.bankAccountName) : null,
          bankAccountNumber: row.bankAccountNumber ? String(row.bankAccountNumber) : null,
        }
      });

      createdCount++;
    }

    const message = skippedCount > 0
      ? `Successfully imported ${createdCount} distributors. Skipped ${skippedCount} duplicate(s).`
      : `Successfully imported ${createdCount} distributors.`;

    res.status(200).json({ status: 'success', message });
  } catch (error: any) {
    console.error('Import Distributors Error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to import distributors. Check server logs.' });
  }
};

export const importOrganizations = async (req: Request, res: Response): Promise<void> => {
  try {
    const { data } = req.body;

    if (!Array.isArray(data) || data.length === 0) {
      res.status(400).json({ status: 'error', message: 'No data provided for import' });
      return;
    }

    let createdCount = 0;
    let skippedCount = 0;

    for (const row of data) {
      if (!row.name) continue; // Skip if no name

      // Check if organization with same name already exists
      const existingOrganization = await prisma.organization.findFirst({
        where: { name: { equals: String(row.name), mode: 'insensitive' } }
      });

      if (existingOrganization) {
        skippedCount++;
        continue;
      }

      // Auto-generate Organization code
      const lastOrg = await prisma.organization.findFirst({
        orderBy: { createdAt: 'desc' },
      });

      let code = 'ORG-0001';
      if (lastOrg && lastOrg.code.startsWith('ORG-')) {
        const lastNumber = parseInt(lastOrg.code.replace('ORG-', ''), 10);
        if (!isNaN(lastNumber)) {
          code = `ORG-${(lastNumber + 1).toString().padStart(4, '0')}`;
        }
      } else if (lastOrg) {
         const count = await prisma.organization.count();
         code = `ORG-${(count + 1).toString().padStart(4, '0')}`;
      }

      await prisma.organization.create({
        data: {
          code: row.code || code,
          name: typeof row.name === 'string' ? row.name : String(row.name),
          email: row.email ? String(row.email) : null,
          phone: row.phone ? String(row.phone) : null,
          address: row.address ? String(row.address) : null,
          website: row.website ? String(row.website) : null,
          npwp: row.npwp ? String(row.npwp) : null,
        }
      });

      createdCount++;
    }

    const message = skippedCount > 0
      ? `Successfully imported ${createdCount} organizations. Skipped ${skippedCount} duplicate(s).`
      : `Successfully imported ${createdCount} organizations.`;

    res.status(200).json({ status: 'success', message });
  } catch (error: any) {
    console.error('Import Organizations Error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to import organizations. Check server logs.' });
  }
};

export const importItemsExcel = async (req: Request, res: Response): Promise<void> => {
  try {
    const { data } = req.body;

    if (!Array.isArray(data) || data.length === 0) {
      res.status(400).json({ status: 'error', message: 'No data provided for import' });
      return;
    }

    // Group the incoming Excel data by Catalog Code or Product Name
    // This allows multiple rows with the same item to aggregate their distributors
    const itemsMap = new Map<string, any>();

    for (const row of data) {
      const rowCode = row['Catalogs'] || row['code'] || '';
      const rowName = row['Nama Product'] || row['name'] || row['product'] || row['Product'];

      if (!rowName) continue; // Skip if no name

      const groupKey = rowCode || rowName;

      if (!itemsMap.has(groupKey)) {
        itemsMap.set(groupKey, {
          code: rowCode,
          name: String(rowName),
          description: row['Spesifikasi'] || row['description'] || '',
          category: row['Category'] || row['category'] || 'General',
          unit: row['Unit'] || row['unit'] || 'Pcs',
          stock: Number(row['Stock'] || row['stock']) || 0,
          distributors: []
        });
      }

      const distName = row['Distributor'] || row['distributor'] || row['dist'];
      if (distName) {
        itemsMap.get(groupKey).distributors.push({
          name: String(distName),
          basePrice: Number(row['Base Price'] || row['basePrice']) || 0,
          discount: Number(row['Disc(%)'] || row['discount'] || row['Disc']) || 0,
          tax: Number(row['Tax(%)'] || row['tax'] || row['Tax']) || 0,
          margin: Number(row['Marg(%)'] || row['margin'] || row['Margin']) || 0,
          sellPrice: Number(row['Sell Price'] || row['sellPrice']) || 0,
        });
      }
    }

    const payload = Array.from(itemsMap.values());
    let createdCount = 0;
    let skippedCount = 0;

    for (const itemData of payload) {
      // Check if item already exists in DB to prevent exact name duplicates
      const existingItem = await prisma.item.findFirst({
        where: { name: { equals: itemData.name, mode: 'insensitive' } }
      });

      if (existingItem) {
        skippedCount++;
        continue;
      }

      const count = await prisma.item.count();
      const code = itemData.code || `ITEM-${(count + 1).toString().padStart(4, '0')}`;

      // Resolve distributor IDs from names and link them
      const itemDistributorsData = [];
      for (const d of itemData.distributors) {
        const dist = await prisma.distributor.findFirst({
           where: { name: { equals: d.name, mode: 'insensitive' } }
        });
        if (dist) {
           itemDistributorsData.push({
              distributorId: dist.id,
              basePrice: d.basePrice,
              discount: d.discount,
              tax: d.tax,
              margin: d.margin,
              sellPrice: d.sellPrice,
           });
        }
      }

      await prisma.item.create({
        data: {
          code,
          name: itemData.name,
          description: itemData.description,
          category: itemData.category,
          unit: itemData.unit,
          stock: itemData.stock,
          itemDistributors: { create: itemDistributorsData }
        }
      });
      createdCount++;
    }

    const message = skippedCount > 0
      ? `Successfully imported ${createdCount} items. Skipped ${skippedCount} duplicate(s).`
      : `Successfully imported ${createdCount} items.`;

    res.status(200).json({ status: 'success', message });
  } catch (error: any) {
    console.error('Import Items Error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to import items. Check server logs.' });
  }
};
