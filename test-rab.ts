import prisma from './src/prisma';
async function main() {
  const project = await prisma.project.findFirst({ orderBy: { createdAt: 'desc' }, include: { rab: { include: { items: true } } }});
  console.log('Project ID:', project?.id);
  console.log('RAB Items Count:', project?.rab?.items?.length);
  const quotes = await prisma.quotation.findMany({ where: { projectId: project?.id }, include: { items: true }});
  console.log('Linked Quotes:', quotes.length, 'Quotes Items:', quotes[0]?.items?.length);
  
  if (project?.rab?.items) {
     console.log('First RAB item:', project.rab.items[0]);
  }
}
main().finally(() => prisma.$disconnect());
