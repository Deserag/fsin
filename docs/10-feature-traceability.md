# Трассировка функций → реализация → раздел ВКР

| Функция | Пользователь | Frontend | Backend | БД (основные таблицы) | Раздел ВКР |
|---|---|---|---|---|---|
| Вход в систему (JWT) | Все | `features/auth/login/` | `auth/` | `User`, `RefreshToken` | 2, 3 |
| RBAC + scope-доступ | Все | `core/guards/*.guard.ts`, `core/services/auth.service.ts` | `auth/guards/roles.guard.ts` + проверки в каждом сервисе | `Role`, `Permission`, `RolePermission`, `UserRole`, `UserGroupScope`, `UserDirectionScope` | 2.3, 3 |
| Управление пользователями | Администратор | `features/admin/users/` | `users/` | `User`, `UserRole`, `UserGroupScope` | 3 |
| Управление ролями и правами | Администратор | `features/admin/roles/` | `roles/` | `Role`, `Permission`, `RolePermission` | 2.3, 3 |
| Карточка студента + история | Администратор, руководитель | `features/students/` | `students/` | `Student`, `StudentGroupHistory`, `StudentStatusHistory`, `StudentCourseHistory` | 1, 3 |
| Управление группами | Администратор | `features/groups/` | `groups/` | `Group`, `GroupForeman` | 3 |
| Назначение старшины | Администратор | `features/groups/` (модалка) | `groups/groups.service.ts::assignForeman` | `GroupForeman`, `UserGroupScope` | 3 |
| Заполнение табеля | Старшина | `features/attendance/` | `attendance/` | `AttendanceSheet`, `AttendanceRecord` | 1, 3, 4 (процесс) |
| Настраиваемые поля табеля | Администратор | `features/admin/reference-data/` (вкладка «Поля табеля») | `settings/` | `AttendanceField`, `AttendanceFieldOption`, `AttendanceFieldValue` | 3 |
| Причины отсутствия | Администратор | `features/admin/reference-data/` | `attendance-reasons/` | `AttendanceReason` | 3 |
| Автоматический перевод курса | Администратор | `features/admin/course-transition/` | `students/course-transition.service.ts` | `Student`, `StudentCourseHistory`, `AcademicYear` | 1, 3, 4 (процесс), 06-testing (баг идемпотентности) |
| Импорт студентов из Excel | Администратор | `features/admin/imports/` | `imports/` | `ImportJob`, `ImportError`, `Student` | 3, 4 (процесс), 06-testing |
| Экспорт в Excel | Администратор, руководитель | `features/admin/reports/` (кнопка) | `exports/` | — (агрегация на лету) | 3 |
| Отчётность (сводная, по группе) | Администратор, руководитель | `features/admin/reports/` | `reports/` | агрегация по `AttendanceSheet`/`AttendanceRecord` | 3, 4 (процесс) |
| Справочники (направления, программы, учебные годы, статусы, периоды) | Администратор | `features/admin/reference-data/` | `directions/`, `programs/`, `academic-years/`, `settings/` | `Direction`, `EducationalProgram`, `AcademicYear`, `StudentStatus`, `AttendancePeriod` | 3 |
| Реквизиты организации | Администратор | `features/admin/organization/` | `organization/` | `Organization` | 2 |
| Журнал аудита | Администратор | `features/admin/audit/` | `audit/` | `AuditLog` | 3 |
| Дашборд (ролезависимый) | Все | `features/dashboard/` | `reports/reports.controller.ts::dashboard` | агрегация | 3 |

## Покрытие тестами (см. `06-testing.md` для деталей)

| Область | Тест-файл | Что проверяется |
|---|---|---|
| RBAC / scope | `test/rbac-scope.e2e-spec.ts` | Видимость данных по ролям, отказ без токена/права |
| Табель | `test/attendance-lifecycle.e2e-spec.ts` | Умолчание «присутствует», обязательность причины, валидация полноты, scope при создании |
| Автоперевод курса | `test/course-transition.e2e-spec.ts` | Корректность предпросмотра, идемпотентность повторного запуска, admin-only доступ |
| Импорт Excel | `test/imports-validation.e2e-spec.ts` | Валидация всего файла (не только превью), точное соответствие числа импортированных строк числу валидных |
| Бизнес-правила табеля (unit) | `src/attendance/attendance.service.spec.ts` | 5 правил `updateRecord` в изоляции от БД |
