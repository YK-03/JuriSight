const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runTest() {
  const countAfter = await prisma.case.count();
  console.log(`STEP 4: Count after reload: ${countAfter}`);
}

runTest()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
