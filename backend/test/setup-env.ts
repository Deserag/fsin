if (!process.env.DATABASE_URL || !new URL(process.env.DATABASE_URL).pathname.startsWith('/fsin_verify_')) throw new Error('Tests require an isolated fsin_verify_ database');
process.env.NODE_ENV='test';
