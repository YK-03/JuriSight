const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function runTest() {
  const data = JSON.parse(fs.readFileSync('cases_backup.json', 'utf-8'));
  
  console.log(`Restoring ${data.length} cases...`);
  await prisma.case.createMany({
    data: data
  });
  console.log("Restore complete.");
}

runTest()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
