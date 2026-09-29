import ExcelJS from 'exceljs';
import { rosterReasons } from '../attendance/roster-reasons.js';

type RosterRecord = {
  studentId: string;
  courseSnapshot: number | null;
  isPresent: boolean | null;
  student: { gender: string | null };
  reason: { code: string } | null;
};
type RosterSheet = {
  date: Date;
  courseSnapshot: number | null;
  period: { name: string; startTime: string | null };
  records: RosterRecord[];
};

const columns = [
  'Курс', 'По списку', 'Из них девушки', 'В институте',
  ...rosterReasons.filter(reason => reason.category === 'IN_INSTITUTE').map(reason => reason.name),
  'Вне института',
  ...rosterReasons.filter(reason => reason.category === 'OUTSIDE').map(reason => reason.name),
];

function count(records: RosterRecord[]) {
  return [
    records.length,
    records.filter(record => record.student.gender === 'FEMALE').length,
    records.filter(record => record.isPresent === true).length,
    ...rosterReasons.filter(reason => reason.category === 'IN_INSTITUTE').map(reason => records.filter(record => record.isPresent === true && record.reason?.code === reason.code).length),
    records.filter(record => record.isPresent === false).length,
    ...rosterReasons.filter(reason => reason.category === 'OUTSIDE').map(reason => records.filter(record => record.isPresent === false && record.reason?.code === reason.code).length),
  ];
}

export function addRosterSheet(workbook: ExcelJS.Workbook, sheets: RosterSheet[]) {
  const ws = workbook.addWorksheet('Строевая записка');
  ws.columns = columns.map((_, index) => ({ width: index === 0 ? 16 : index === 2 ? 17 : 14 }));
  const sections = new Map<string, { date: Date; period: RosterSheet['period']; byCourse: Map<string, Map<string, RosterRecord>> }>();
  for (const sheet of sheets) {
    const key = `${sheet.date.toISOString().slice(0, 10)}:${sheet.period.name}`;
    if (!sections.has(key)) sections.set(key, { date: sheet.date, period: sheet.period, byCourse: new Map() });
    const section = sections.get(key)!;
    for (const record of sheet.records) {
      const course = String(record.courseSnapshot ?? sheet.courseSnapshot ?? 'Не указан');
      if (!section.byCourse.has(course)) section.byCourse.set(course, new Map());
      section.byCourse.get(course)!.set(record.studentId, record);
    }
  }
  for (const section of sections.values()) {
    const title = ws.addRow([`Строевая записка переменного состава УСП и КПК на ${section.period.startTime ?? section.period.name} · ${section.date.toLocaleDateString('ru-RU')}`]);
    ws.mergeCells(title.number, 1, title.number, columns.length);
    title.font = { bold: true, size: 15 };
    title.height = 30;
    const header = ws.addRow(columns);
    header.height = 48;
    header.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF194D67' } };
    const totals = Array(columns.length - 1).fill(0) as number[];
    const entries = [...section.byCourse.entries()].sort(([a], [b]) => Number(a) - Number(b));
    for (const [course, unique] of entries) {
      const values = count([...unique.values()]);
      values.forEach((value, index) => totals[index] += value);
      ws.addRow([course === 'Не указан' ? course : `${course} курс`, ...values]);
    }
    const total = ws.addRow(['Всего УСП', ...totals]);
    total.font = { bold: true };
    total.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE9F3F6' } };
    ws.addRow(['Оперативный дежурный', '________________']);
    ws.addRow(['вн. сл.', '________________']);
    ws.addRow(['Примечание: пол и категория старых записей могут быть не указаны.']);
    ws.addRow([]);
  }
  ws.eachRow(row => {
    if (row.number === 1 || String(row.getCell(1).value ?? '').startsWith('Примечание')) return;
    row.eachCell(cell => { cell.border = { bottom: { style: 'hair', color: { argb: 'FFD8E2E7' } } }; });
  });
  ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  return ws;
}
