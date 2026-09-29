import {describe,it,expect,vi} from 'vitest';
import {AcademicYearsService} from './academic-years.service.js';
function setup(duplicate:any=null){const tx:any={$queryRaw:vi.fn(),academicYear:{findFirst:vi.fn().mockResolvedValueOnce(duplicate).mockResolvedValue(null),create:vi.fn(x=>x.data),updateMany:vi.fn()}};return {tx,service:new AcademicYearsService({$transaction:(fn:any)=>fn(tx)} as any)};}
describe('Academic years regression',()=>{
 it('converts HTML date input strings into Prisma Date values',async()=>{const {service,tx}=setup();await service.create({name:'2040/2041',startDate:'2040-09-01',endDate:'2041-08-31'},'org');expect(tx.academicYear.create).toHaveBeenCalledWith({data:expect.objectContaining({name:'2040-2041',startDate:new Date('2040-09-01'),endDate:new Date('2041-08-31')})});});
 it('returns a useful duplicate message',async()=>{const {service}=setup({id:'existing'});await expect(service.create({name:'2040/2041',startDate:'2040-09-01',endDate:'2041-08-31'},'org')).rejects.toThrow('Учебный год 2040-2041 уже существует');});
 it('rejects reversed dates before calling Prisma create',async()=>{const {service,tx}=setup();await expect(service.create({name:'bad',startDate:'2041-09-01',endDate:'2040-08-31'},'org')).rejects.toThrow('корректные даты');expect(tx.academicYear.create).not.toHaveBeenCalled();});
});
