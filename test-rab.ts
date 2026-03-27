import prisma from './src/prisma';

async function run() {
  const projectId = 'cmmz1wz7700374krxvns19y62';

  try {
    const quotation = await prisma.quotation.findFirst({
      where: { projectId },
      orderBy: { date: 'desc' },
      include: {
        items: {
          include: {
            distributor: true, // we need distributor to lookup ItemDistributor
            item: true, // fetch item details directly from the relation
          }
        }
      }
    });

    if (!quotation) {
      console.log('No quotation found');
      return;
    }

    let rab = await prisma.rAB.findUnique({ where: { projectId } });
    if (!rab) {
       rab = await prisma.rAB.create({ data: { projectId } });
    }

    const existingItems = await prisma.rABItem.findMany({
      where: { rabId: rab.id },
    });
    const existingByItemId = new Map<string, typeof existingItems[0]>();
    for (const ei of existingItems) {
      if (ei.itemId) existingByItemId.set(ei.itemId, ei);
    }

    const incomingItemIds = new Set<string>();

    const rabItemPromises = quotation.items.map(async (qItem: any) => {
      let unitCost = qItem.price;
      let description = qItem.item ? qItem.item.name : 'Material';
      let suppName = "";

      const itemNode = qItem.item;
      if (itemNode) {
        description = itemNode.name;
        if (itemNode.code) {
          description = `[${itemNode.code}] ${description}`;
        }

        if (qItem.distributorId) {
          const itemDistributor = await prisma.itemDistributor.findUnique({
             where: {
               itemId_distributorId: {
                 itemId: qItem.itemId,
                 distributorId: qItem.distributorId
               }
             },
             include: { distributor: true }
          });

          if (itemDistributor) {
             suppName = itemDistributor.distributor.name;
             description += ` - ${suppName}`;

            const basePrice = itemDistributor.basePrice;
            const discountPct = itemDistributor.discount;
            const taxPct = itemDistributor.tax;

            const netPrice = basePrice - (basePrice * (discountPct / 100));
            const taxYield = netPrice * (taxPct / 100);
            unitCost = netPrice + taxYield;
          }
        }
      }

      const totalPrice = unitCost * qItem.quantity;

      if (qItem.itemId) incomingItemIds.add(qItem.itemId);

      const existing = qItem.itemId ? existingByItemId.get(qItem.itemId) : null;

      if (existing) {
        return prisma.rABItem.update({
          where: { id: existing.id },
          data: {
            description,
            quantity: qItem.quantity,
            unit: itemNode?.unit || existing.unit,
            unitPrice: unitCost,
            totalPrice,
            supplier: suppName || existing.supplier,
          },
        });
      } else {
        return prisma.rABItem.create({
          data: {
            rabId: rab!.id,
            itemId: qItem.itemId || null,
            description,
            quantity: qItem.quantity,
            unit: itemNode?.unit || "Unit",
            unitPrice: unitCost,
            totalPrice,
            supplier: suppName || null,
          },
        });
      }
    });

    const obsoleteItems = existingItems.filter(
      (ei) => ei.itemId && !incomingItemIds.has(ei.itemId)
    );
    if (obsoleteItems.length > 0) {
      await prisma.rABItem.deleteMany({
        where: { id: { in: obsoleteItems.map((i) => i.id) } },
      });
    }

    await Promise.all(rabItemPromises);
    console.log('ALL PASSED');

  } catch (e) {
    console.error('CRASH', e);
  }
}

run().catch(console.error);
