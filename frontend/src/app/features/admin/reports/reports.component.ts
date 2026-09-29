import { Component, Input, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { ReportsService } from '../../../core/services/reports.service';
import { GroupsService } from '../../../core/services/groups.service';
import { ReferenceDataService } from '../../../core/services/reference-data.service';
import { ExportsService } from '../../../core/services/exports.service';
import { AuthService } from '../../../core/services/auth.service';
@Component({selector:'app-reports',standalone:true,imports:[CommonModule,FormsModule],templateUrl:'./reports.component.html',styleUrl:'./reports.component.scss'})
export class ReportsComponent implements OnInit {
 @Input() dashboard=false;
 readonly data=signal<any>(null);readonly metrics=signal<any>(null);readonly error=signal('');readonly loading=signal(false);
 groups:any[]=[];programs:any[]=[];statuses:any[]=[];reasons:any[]=[];years:any[]=[];
 from='';to='';course='';group:string[]=[];program:string[]=[];statusId='';reasonId='';academicYearId='';
 constructor(private api:ReportsService,private groupApi:GroupsService,private ref:ReferenceDataService,private exports:ExportsService,readonly auth:AuthService){}
 ngOnInit(){forkJoin({groups:this.groupApi.list(),programs:this.ref.programs(),statuses:this.ref.statuses(),reasons:this.ref.reasons(),years:this.ref.academicYears()}).subscribe({next:r=>{this.groups=r.groups.data;this.programs=r.programs;this.statuses=r.statuses;this.reasons=r.reasons;this.years=r.years;this.quick('month');},error:e=>this.error.set(e.error?.message??'Не удалось загрузить фильтры')});}
 params():Record<string,string>{const q:Record<string,string>={};for(const [k,v] of Object.entries({from:this.from,to:this.to,course:this.course,group:this.group.join(','),program:this.program.join(','),statusId:this.statusId,reasonId:this.reasonId,academicYearId:this.academicYearId}))if(v)q[k]=v;return q;}
 quick(value:string){const end=new Date(),start=new Date();const iso=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;this.to=iso(end);if(value==='week')start.setDate(start.getDate()-6);if(value==='month')start.setDate(1);this.from=iso(start);if(value==='year'){const year=this.years.find(y=>y.isCurrent);if(year){this.from=year.startDate.slice(0,10);this.to=year.endDate.slice(0,10);}else this.from=`${end.getMonth()<8?end.getFullYear()-1:end.getFullYear()}-09-01`;}this.load();}
 load(){this.loading.set(true);this.error.set('');(this.dashboard?this.api.dashboard(this.params()):this.api.attendance(this.params())).subscribe({next:d=>{this.data.set(this.dashboard?d.analytics:d);this.metrics.set(this.dashboard?d:null);this.loading.set(false);},error:e=>{this.loading.set(false);this.error.set(e.error?.message??'Не удалось построить отчет');}});}
 drillCourse(course:number|null){if(course!==null){this.course=String(course);this.group=[];this.load();}}
 drillGroup(id:string){this.group=[id];this.load();}
 points(){const data=this.data()?.daily??[];return data.map((d:any,i:number)=>`${30+i*640/Math.max(1,data.length-1)},${170-d.attendanceRate*1.4}`).join(' ');}
 reasonWidth(count:number){const max=Math.max(1,...(this.data()?.reasons??[]).map((r:any)=>r.count));return 100*count/max;}
 async exportAttendance(){try{await this.exports.downloadAttendance(this.params());}catch(e:any){this.error.set('Не удалось экспортировать отчет');}}
}
