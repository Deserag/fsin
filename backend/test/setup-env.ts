// Runs before any e2e test file's imports resolve. Points Prisma at an
// isolated test database so e2e tests never touch the demo/dev data that
// backs the running app.
process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/fsin_crm_test?schema=public';
process.env.NODE_ENV = 'test';
