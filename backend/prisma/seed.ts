import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // ── Organization ────────────────────────────────────────
  const org = await prisma.organization.upsert({
    where: { code: 'VIFSIN' },
    update: {},
    create: {
      name: 'Воронежский институт ФСИН России',
      shortName: 'ВИ ФСИН России',
      code: 'VIFSIN',
      address: 'г. Воронеж, ул. Иркутская, 1а',
      phone: '+7 (473) 260-12-50',
      email: 'info@vifsin.ru',
      headName: 'Начальник института',
    },
  });
  console.log(`✅ Organization: ${org.name}`);

  // ── Roles ───────────────────────────────────────────────
  const adminRole = await prisma.role.upsert({
    where: { name: 'admin' },
    update: {},
    create: { name: 'admin', displayName: 'Администратор', description: 'Полный доступ к системе', isSystem: true },
  });

  const managerRole = await prisma.role.upsert({
    where: { name: 'manager' },
    update: {},
    create: { name: 'manager', displayName: 'Руководитель / Куратор', description: 'Доступ к назначенным направлениям', isSystem: true },
  });

  const foremanRole = await prisma.role.upsert({
    where: { name: 'foreman' },
    update: {},
    create: { name: 'foreman', displayName: 'Старшина', description: 'Доступ к назначенным группам', isSystem: true },
  });
  console.log('✅ Roles: admin, manager, foreman');

  // ── Permissions ─────────────────────────────────────────
  const permissions = [
    { code: 'STUDENTS_READ', displayName: 'Просмотр студентов', module: 'students' },
    { code: 'STUDENTS_WRITE', displayName: 'Управление студентами', module: 'students' },
    { code: 'GROUPS_READ', displayName: 'Просмотр групп', module: 'groups' },
    { code: 'GROUPS_WRITE', displayName: 'Управление группами', module: 'groups' },
    { code: 'ATTENDANCE_READ', displayName: 'Просмотр табелей', module: 'attendance' },
    { code: 'ATTENDANCE_WRITE', displayName: 'Заполнение табелей', module: 'attendance' },
    { code: 'ATTENDANCE_CLOSE', displayName: 'Закрытие табелей', module: 'attendance' },
    { code: 'REPORTS_READ', displayName: 'Просмотр отчётов', module: 'reports' },
    { code: 'REPORTS_EXPORT', displayName: 'Экспорт отчётов', module: 'reports' },
    { code: 'IMPORT_EXECUTE', displayName: 'Импорт данных', module: 'imports' },
    { code: 'USERS_READ', displayName: 'Просмотр пользователей', module: 'users' },
    { code: 'USERS_WRITE', displayName: 'Управление пользователями', module: 'users' },
    { code: 'AUDIT_READ', displayName: 'Просмотр журнала аудита', module: 'audit' },
    { code: 'SETTINGS_WRITE', displayName: 'Управление настройками', module: 'settings' },
    { code: 'COURSE_TRANSITION', displayName: 'Перевод курса', module: 'students' },
  ];

  for (const perm of permissions) {
    await prisma.permission.upsert({
      where: { code: perm.code },
      update: {},
      create: perm,
    });
  }
  console.log(`✅ Permissions: ${permissions.length} created`);

  // Assign all permissions to admin
  const allPerms = await prisma.permission.findMany();
  for (const perm of allPerms) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: adminRole.id, permissionId: perm.id } },
      update: {},
      create: { roleId: adminRole.id, permissionId: perm.id },
    });
  }

  // Manager permissions
  const managerPermCodes = ['STUDENTS_READ', 'GROUPS_READ', 'ATTENDANCE_READ', 'ATTENDANCE_WRITE', 'REPORTS_READ', 'REPORTS_EXPORT'];
  for (const code of managerPermCodes) {
    const perm = allPerms.find((p) => p.code === code);
    if (perm) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: managerRole.id, permissionId: perm.id } },
        update: {},
        create: { roleId: managerRole.id, permissionId: perm.id },
      });
    }
  }

  // Foreman permissions
  const foremanPermCodes = ['STUDENTS_READ', 'GROUPS_READ', 'ATTENDANCE_READ', 'ATTENDANCE_WRITE'];
  for (const code of foremanPermCodes) {
    const perm = allPerms.find((p) => p.code === code);
    if (perm) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: foremanRole.id, permissionId: perm.id } },
        update: {},
        create: { roleId: foremanRole.id, permissionId: perm.id },
      });
    }
  }

  // ── Users ───────────────────────────────────────────────
  const passwordHash = await argon2.hash('Admin123!');

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@vifsin.ru' },
    update: {},
    create: {
      organizationId: org.id,
      email: 'admin@vifsin.ru',
      passwordHash,
      firstName: 'Александр',
      lastName: 'Петров',
      middleName: 'Николаевич',
      phone: '+7 (473) 260-12-51',
    },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: adminUser.id, roleId: adminRole.id } },
    update: {},
    create: { userId: adminUser.id, roleId: adminRole.id },
  });

  const managerUser = await prisma.user.upsert({
    where: { email: 'manager@vifsin.ru' },
    update: {},
    create: {
      organizationId: org.id,
      email: 'manager@vifsin.ru',
      passwordHash,
      firstName: 'Елена',
      lastName: 'Сидорова',
      middleName: 'Ивановна',
    },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: managerUser.id, roleId: managerRole.id } },
    update: {},
    create: { userId: managerUser.id, roleId: managerRole.id },
  });

  const foreman1 = await prisma.user.upsert({
    where: { email: 'foreman1@vifsin.ru' },
    update: {},
    create: {
      organizationId: org.id,
      email: 'foreman1@vifsin.ru',
      passwordHash,
      firstName: 'Дмитрий',
      lastName: 'Козлов',
      middleName: 'Андреевич',
    },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: foreman1.id, roleId: foremanRole.id } },
    update: {},
    create: { userId: foreman1.id, roleId: foremanRole.id },
  });

  const foreman2 = await prisma.user.upsert({
    where: { email: 'foreman2@vifsin.ru' },
    update: {},
    create: {
      organizationId: org.id,
      email: 'foreman2@vifsin.ru',
      passwordHash,
      firstName: 'Мария',
      lastName: 'Новикова',
      middleName: 'Сергеевна',
    },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: foreman2.id, roleId: foremanRole.id } },
    update: {},
    create: { userId: foreman2.id, roleId: foremanRole.id },
  });

  console.log('✅ Users: admin, manager, foreman1, foreman2 (password: Admin123!)');

  // ── Academic Years ───────────────────────────────────────
  await prisma.academicYear.updateMany({ where: { organizationId: org.id }, data: { isCurrent: false } });

  const ay2324 = await prisma.academicYear.upsert({
    where: { organizationId_name: { organizationId: org.id, name: '2023-2024' } },
    update: {},
    create: { organizationId: org.id, name: '2023-2024', startDate: new Date('2023-09-01'), endDate: new Date('2024-06-30'), isCurrent: false },
  });

  const ay2425 = await prisma.academicYear.upsert({
    where: { organizationId_name: { organizationId: org.id, name: '2024-2025' } },
    update: {},
    create: { organizationId: org.id, name: '2024-2025', startDate: new Date('2024-09-01'), endDate: new Date('2025-06-30'), isCurrent: false },
  });

  const ay2526 = await prisma.academicYear.upsert({
    where: { organizationId_name: { organizationId: org.id, name: '2025-2026' } },
    update: { isCurrent: true },
    create: { organizationId: org.id, name: '2025-2026', startDate: new Date('2025-09-01'), endDate: new Date('2026-06-30'), isCurrent: true },
  });
  console.log('✅ Academic years: 2023-2024, 2024-2025, 2025-2026 (current)');

  // ── Directions ───────────────────────────────────────────
  const dirLaw = await prisma.direction.upsert({
    where: { organizationId_code: { organizationId: org.id, code: 'LAW' } },
    update: {},
    create: { organizationId: org.id, code: 'LAW', name: 'Юриспруденция', shortName: 'Юрид.' },
  });

  const dirEcon = await prisma.direction.upsert({
    where: { organizationId_code: { organizationId: org.id, code: 'ECON' } },
    update: {},
    create: { organizationId: org.id, code: 'ECON', name: 'Экономика и управление', shortName: 'Эконом.' },
  });

  const dirIt = await prisma.direction.upsert({
    where: { organizationId_code: { organizationId: org.id, code: 'IT' } },
    update: {},
    create: { organizationId: org.id, code: 'IT', name: 'Информационные технологии', shortName: 'ИТ' },
  });
  console.log('✅ Directions: LAW, ECON, IT');

  // Assign direction scopes to manager
  await prisma.userDirectionScope.upsert({
    where: { userId_directionId: { userId: managerUser.id, directionId: dirLaw.id } },
    update: {},
    create: { userId: managerUser.id, directionId: dirLaw.id },
  });
  await prisma.userDirectionScope.upsert({
    where: { userId_directionId: { userId: managerUser.id, directionId: dirEcon.id } },
    update: {},
    create: { userId: managerUser.id, directionId: dirEcon.id },
  });

  // ── Programs ─────────────────────────────────────────────
  const progLawBach = await prisma.educationalProgram.upsert({
    where: { organizationId_code: { organizationId: org.id, code: 'LAW_BACH' } },
    update: {},
    create: {
      organizationId: org.id, directionId: dirLaw.id, code: 'LAW_BACH',
      name: 'Юриспруденция (бакалавриат)', shortName: 'Бакалавриат', durationYears: 4, maxCourse: 4,
    },
  });

  const progLawSpec = await prisma.educationalProgram.upsert({
    where: { organizationId_code: { organizationId: org.id, code: 'LAW_SPEC' } },
    update: {},
    create: {
      organizationId: org.id, directionId: dirLaw.id, code: 'LAW_SPEC',
      name: 'Правоохранительная деятельность (специалитет)', shortName: 'Специалитет', durationYears: 5, maxCourse: 5,
    },
  });

  const progEcon = await prisma.educationalProgram.upsert({
    where: { organizationId_code: { organizationId: org.id, code: 'ECON_BACH' } },
    update: {},
    create: {
      organizationId: org.id, directionId: dirEcon.id, code: 'ECON_BACH',
      name: 'Экономика (бакалавриат)', shortName: 'Экономика', durationYears: 4, maxCourse: 4,
    },
  });

  const progIt = await prisma.educationalProgram.upsert({
    where: { organizationId_code: { organizationId: org.id, code: 'IT_BACH' } },
    update: {},
    create: {
      organizationId: org.id, directionId: dirIt.id, code: 'IT_BACH',
      name: 'Информационная безопасность (бакалавриат)', shortName: 'Инфобез', durationYears: 4, maxCourse: 4,
    },
  });
  console.log('✅ Programs: LAW_BACH, LAW_SPEC, ECON_BACH, IT_BACH');

  // ── Student Statuses ─────────────────────────────────────
  const statuses: any[] = [
    { code: 'STUDYING', name: 'Обучается', sortOrder: 0, isTerminal: false },
    { code: 'ACADEMIC_LEAVE', name: 'Академический отпуск', sortOrder: 1, isTerminal: false },
    { code: 'EXPELLED', name: 'Отчислен', sortOrder: 2, isTerminal: true },
    { code: 'TRANSFERRED', name: 'Переведён', sortOrder: 3, isTerminal: true },
    { code: 'GRADUATED', name: 'Обучение завершено', sortOrder: 4, isTerminal: true },
  ];

  const statusMap: Record<string, string> = {};
  for (const s of statuses) {
    const st = await prisma.studentStatus.upsert({
      where: { organizationId_code: { organizationId: org.id, code: s.code } },
      update: {},
      create: { organizationId: org.id, ...s },
    });
    statusMap[s.code] = st.id;
  }
  console.log('✅ Student statuses: 5 statuses');

  // ── Attendance Periods ───────────────────────────────────
  const periodMorning = await prisma.attendancePeriod.upsert({
    where: { organizationId_code: { organizationId: org.id, code: 'MORNING' } },
    update: {},
    create: { organizationId: org.id, code: 'MORNING', name: 'Утро', startTime: '08:00', endTime: '12:00', sortOrder: 0 },
  });

  const periodEvening = await prisma.attendancePeriod.upsert({
    where: { organizationId_code: { organizationId: org.id, code: 'EVENING' } },
    update: {},
    create: { organizationId: org.id, code: 'EVENING', name: 'Вечер', startTime: '18:00', endTime: '20:00', sortOrder: 1 },
  });
  console.log('✅ Attendance periods: Утро, Вечер');

  // ── Attendance Reasons ────────────────────────────────────
  const reasons: any[] = [
    { code: 'ILLNESS', name: 'Болезнь', sortOrder: 0 },
    { code: 'VALID', name: 'Уважительная причина', sortOrder: 1 },
    { code: 'SERVICE', name: 'Служебная необходимость', sortOrder: 2 },
    { code: 'VACATION', name: 'Отпуск', sortOrder: 3 },
    { code: 'BUSINESS_TRIP', name: 'Командировка', sortOrder: 4 },
    { code: 'OTHER', name: 'Другое', requiresNote: true, sortOrder: 5 },
  ];

  const reasonMap: Record<string, string> = {};
  for (const r of reasons) {
    const reason = await prisma.attendanceReason.upsert({
      where: { organizationId_code: { organizationId: org.id, code: r.code } },
      update: {},
      create: { organizationId: org.id, ...r },
    });
    reasonMap[r.code] = reason.id;
  }
  console.log('✅ Attendance reasons: 6 reasons');

  // ── Groups ───────────────────────────────────────────────
  const groupDefs = [
    { name: '101', programId: progLawBach.id, directionId: dirLaw.id, currentCourse: 1, yearId: ay2526.id },
    { name: '201', programId: progLawBach.id, directionId: dirLaw.id, currentCourse: 2, yearId: ay2526.id },
    { name: '301', programId: progLawBach.id, directionId: dirLaw.id, currentCourse: 3, yearId: ay2526.id },
    { name: '401', programId: progLawBach.id, directionId: dirLaw.id, currentCourse: 4, yearId: ay2526.id },
    { name: '102', programId: progEcon.id, directionId: dirEcon.id, currentCourse: 1, yearId: ay2526.id },
    { name: '202', programId: progEcon.id, directionId: dirEcon.id, currentCourse: 2, yearId: ay2526.id },
    { name: '103', programId: progIt.id, directionId: dirIt.id, currentCourse: 1, yearId: ay2526.id },
    { name: '203', programId: progIt.id, directionId: dirIt.id, currentCourse: 2, yearId: ay2526.id },
  ];

  const groups: any[] = [];
  for (const gd of groupDefs) {
    const g = await prisma.group.upsert({
      where: { organizationId_name_academicYearId: { organizationId: org.id, name: gd.name, academicYearId: gd.yearId } },
      update: {},
      create: {
        organizationId: org.id, name: gd.name, academicYearId: gd.yearId,
        directionId: gd.directionId, programId: gd.programId, currentCourse: gd.currentCourse, maxStudents: 25,
      },
    });
    groups.push(g);
  }
  console.log(`✅ Groups: ${groups.length} groups created`);

  // Assign foreman1 to group 201, foreman2 to group 202
  const group201 = groups.find((g) => g.name === '201');
  const group202 = groups.find((g) => g.name === '202');

  if (group201) {
    await prisma.groupForeman.upsert({
      where: { id: (await prisma.groupForeman.findFirst({ where: { groupId: group201.id, isActive: true } }))?.id ?? 'new-201' },
      update: {},
      create: { groupId: group201.id, userId: foreman1.id, isActive: true },
    }).catch(() => prisma.groupForeman.create({ data: { groupId: group201.id, userId: foreman1.id, isActive: true } }));

    await prisma.userGroupScope.upsert({
      where: { userId_groupId: { userId: foreman1.id, groupId: group201.id } },
      update: {},
      create: { userId: foreman1.id, groupId: group201.id },
    });
  }

  if (group202) {
    await prisma.groupForeman.create({ data: { groupId: group202.id, userId: foreman2.id, isActive: true } }).catch(() => {});
    await prisma.userGroupScope.upsert({
      where: { userId_groupId: { userId: foreman2.id, groupId: group202.id } },
      update: {},
      create: { userId: foreman2.id, groupId: group202.id },
    });
  }
  console.log('✅ Foreman assignments: foreman1→201, foreman2→202');

  // ── Students ─────────────────────────────────────────────
  const lastNames = ['Иванов', 'Петров', 'Сидоров', 'Козлов', 'Новиков', 'Морозов', 'Волков', 'Алексеев', 'Лебедев', 'Семёнов', 'Егоров', 'Павлов', 'Кузнецов', 'Соловьёв', 'Попов'];
  const firstNames = ['Александр', 'Михаил', 'Дмитрий', 'Сергей', 'Андрей', 'Николай', 'Алексей', 'Иван', 'Павел', 'Максим'];
  const middleNames = ['Александрович', 'Михайлович', 'Дмитриевич', 'Сергеевич', 'Андреевич', 'Николаевич', 'Алексеевич', 'Иванович', 'Павлович', 'Максимович'];

  let studentCount = 0;
  for (const group of groups) {
    const studentCountForGroup = 12 + Math.floor(Math.random() * 8); // 12-20 students per group
    for (let i = 0; i < studentCountForGroup; i++) {
      const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
      const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
      const middleName = middleNames[Math.floor(Math.random() * middleNames.length)];
      const internalId = `${group.name}-${String(i + 1).padStart(3, '0')}`;
      const birthYear = 1998 + Math.floor(Math.random() * 5);

      const existing = await prisma.student.findFirst({
        where: { organizationId: org.id, internalId },
      });
      if (existing) continue;

      await prisma.student.create({
        data: {
          organizationId: org.id,
          internalId,
          lastName,
          firstName,
          middleName,
          birthDate: new Date(`${birthYear}-${String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')}-15`),
          enrollmentDate: new Date('2022-09-01'),
          academicYearId: ay2526.id,
          currentCourse: group.currentCourse,
          programId: group.programId,
          statusId: statusMap['STUDYING'],
          currentGroupId: group.id,
        },
      });
      studentCount++;
    }
  }
  console.log(`✅ Students: ${studentCount} students created`);

  // ── Attendance History (last 14 days) ───────────────────
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let sheetCount = 0;
  for (let daysAgo = 14; daysAgo >= 1; daysAgo--) {
    const date = new Date(today);
    date.setDate(date.getDate() - daysAgo);

    // Only weekdays
    const dow = date.getDay();
    if (dow === 0 || dow === 6) continue;

    for (const group of groups.slice(0, 4)) {
      for (const period of [periodMorning, periodEvening]) {
        const existingSheet = await prisma.attendanceSheet.findFirst({
          where: { groupId: group.id, periodId: period.id, date },
        });
        if (existingSheet) continue;

        const students = await prisma.student.findMany({
          where: { currentGroupId: group.id, isActive: true },
          select: { id: true },
        });

        if (students.length === 0) continue;

        const sheet = await prisma.attendanceSheet.create({
          data: {
            groupId: group.id,
            periodId: period.id,
            date,
            totalCount: students.length,
            status: 'CLOSED',
            submittedAt: date,
            reviewedAt: date,
            closedAt: date,
          },
        });

        let presentCount = 0;
        let absentCount = 0;

        for (const student of students) {
          const isPresent = Math.random() > 0.1; // 90% attendance rate
          const reasonId = !isPresent ? reasonMap[Object.keys(reasonMap)[Math.floor(Math.random() * 4)]] : null;

          await prisma.attendanceRecord.create({
            data: {
              sheetId: sheet.id,
              studentId: student.id,
              isPresent,
              reasonId,
              markedBy: foreman1.id,
            },
          });

          if (isPresent) presentCount++;
          else absentCount++;
        }

        await prisma.attendanceSheet.update({
          where: { id: sheet.id },
          data: { presentCount, absentCount },
        });

        sheetCount++;
      }
    }
  }
  console.log(`✅ Attendance history: ${sheetCount} sheets created`);

  // ── System Settings ──────────────────────────────────────
  const settingsToCreate = [
    { key: 'courseTransitionDate', value: '08-30', description: 'Дата автоматического перевода курса (MM-DD)' },
    { key: 'academicYearStartMonth', value: '9', description: 'Месяц начала учебного года' },
    { key: 'maxAbsenceBeforeAlert', value: '3', description: 'Количество пропусков до предупреждения' },
  ];

  for (const s of settingsToCreate) {
    await prisma.systemSetting.upsert({
      where: { organizationId_key: { organizationId: org.id, key: s.key } },
      update: {},
      create: { organizationId: org.id, ...s },
    });
  }
  console.log('✅ System settings created');

  // ── Audit log entries ─────────────────────────────────────
  await prisma.auditLog.create({
    data: {
      organizationId: org.id,
      userId: adminUser.id,
      action: 'SEED',
      entityType: 'System',
      newValue: { message: 'Database seeded successfully', timestamp: new Date().toISOString() },
    },
  });

  console.log('\n🎉 Seed completed successfully!');
  console.log('─────────────────────────────────────');
  console.log('Demo accounts (password: Admin123!):');
  console.log('  admin@vifsin.ru     → Администратор');
  console.log('  manager@vifsin.ru   → Руководитель');
  console.log('  foreman1@vifsin.ru  → Старшина (группа 201)');
  console.log('  foreman2@vifsin.ru  → Старшина (группа 202)');
  console.log('─────────────────────────────────────');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
