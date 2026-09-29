import { describe,it,expect } from 'vitest';
import { stateOnDate } from './roster.js';
import { assertGroup,groupScope } from '../auth/scope.js';
const studying={id:'studying',isTerminal:false,countsInAttendance:true};
const expelled={id:'expelled',isTerminal:true,countsInAttendance:false};
const student={currentCourse:3,enrollmentDate:new Date('2024-09-01'),status:expelled,statusHistory:[{changeDate:new Date('2024-09-01'),status:studying},{changeDate:new Date('2026-09-15'),status:expelled}],groupHistory:[{groupId:'old',joinDate:new Date('2024-09-01'),leaveDate:new Date('2025-09-01')},{groupId:'new',joinDate:new Date('2025-09-01'),leaveDate:null}],courseHistory:[{fromCourse:1,toCourse:2,transitionDate:new Date('2025-09-01')},{fromCourse:2,toCourse:3,transitionDate:new Date('2026-09-01')}]};
describe('Historical roster',()=>{
 it('uses previous course and group, not current state',()=>{expect(stateOnDate(student,new Date('2025-02-01'))).toMatchObject({course:1,groupId:'old',eligible:true});});
 it('excludes student on the expulsion date but preserves earlier membership',()=>{expect(stateOnDate(student,new Date('2026-09-14')).eligible).toBe(true);expect(stateOnDate(student,new Date('2026-09-15')).eligible).toBe(false);});
 it('uses half-open group intervals',()=>{expect(stateOnDate(student,new Date('2025-09-01')).groupId).toBe('new');});
 it('denies empty custom-role scope',()=>{expect(()=>assertGroup({id:'g',organizationId:'o'},{organizationId:'o',roles:['custom'],groupScopeIds:[],directionScopeIds:[]})).toThrow();});
 it('administrator role takes precedence in multi-role accounts',()=>{expect(groupScope({organizationId:'o',roles:['foreman','admin']})).toEqual({organizationId:'o'});});
});
