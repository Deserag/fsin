// All intervals are calendar dates: a leaving/status-change date is effective that day.
export function stateOnDate(student: any, date: Date) {
 const day = date.toISOString().slice(0, 10);
 const onOrBefore = (d: Date) => d.toISOString().slice(0, 10) <= day;
 const statuses = [...(student.statusHistory ?? [])].sort((a,b) => +b.changeDate - +a.changeDate);
 const status = statuses.find(h => onOrBefore(h.changeDate))?.status ?? (!statuses.length ? student.status : null);
 const courses = [...(student.courseHistory ?? [])].sort((a,b) => +a.transitionDate - +b.transitionDate);
 const previous = courses.filter(h => onOrBefore(h.transitionDate)).at(-1);
 const next = courses.find(h => !onOrBefore(h.transitionDate));
 const course = previous?.toCourse ?? next?.fromCourse ?? student.currentCourse;
 const membership = student.groupHistory?.find((h: any) => onOrBefore(h.joinDate) && (!h.leaveDate || !onOrBefore(h.leaveDate)));
 return { status, course, groupId: membership?.groupId,
   eligible: !!status && !status.isTerminal && status.countsInAttendance !== false &&
    (!student.enrollmentDate || onOrBefore(student.enrollmentDate)) };
}
export const rosterInclude = { status: true, statusHistory: { include: { status: true } }, groupHistory: true, courseHistory: true };
