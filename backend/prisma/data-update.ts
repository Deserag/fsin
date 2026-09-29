import { PrismaClient } from '@prisma/client';
import { updateReferenceData } from './reference-data.js';
const prisma=new PrismaClient();
try { console.log('Обновление справочников:',await updateReferenceData(prisma)); }
catch(error){ console.error(error);process.exitCode=1; }
finally{ await prisma.$disconnect(); }
