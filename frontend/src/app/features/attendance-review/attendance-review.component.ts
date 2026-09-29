import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AttendanceService } from '../../core/services/attendance.service';
import { AuthService } from '../../core/services/auth.service';
import { forkJoin, firstValueFrom } from 'rxjs';
@Component({selector:'app-attendance-review',standalone:true,imports:[CommonModule,FormsModule,RouterLink],templateUrl:'./attendance-review.component.html',styleUrl:'./attendance-review.component.scss'})
export class AttendanceReviewComponent implements OnInit {
 readonly batches=signal<any[]>([]);readonly details=signal<any[]>([]);readonly error=signal('');readonly busy=signal(false);status='SUBMITTED';comment='';selected:any=null;
 constructor(private api:AttendanceService,readonly auth:AuthService){}
 ngOnInit(){this.load();}
 load(){this.api.reviewQueue(this.status).subscribe({next:r=>{const map=new Map<string,any>();for(const s of r.data){const key=[s.academicYearSnapshotId,s.courseSnapshot,s.date,s.periodId].join(':');if(!map.has(key))map.set(key,{key,course:s.courseSnapshot,date:s.date,period:s.period,academicYearId:s.academicYearSnapshotId,periodId:s.periodId,sheets:[],total:0,present:0,absent:0});const b=map.get(key);b.sheets.push(s);b.total+=s.totalCount;b.present+=s.presentCount;b.absent+=s.absentCount;}this.batches.set([...map.values()]);},error:e=>this.error.set(e.error?.message??'Не удалось загрузить очередь')});}
 open(batch:any){this.selected=batch;this.comment='';this.error.set('');forkJoin(batch.sheets.map((s:any)=>this.api.getSheet(s.id))).subscribe({next:(s:any)=>this.details.set(s),error:e=>this.error.set(e.error?.message??'Не удалось открыть')});}
 async act(action:string){if(!this.selected)return;this.busy.set(true);this.error.set('');try{const b=this.selected;if(b.course&&b.academicYearId)await firstValueFrom(this.api.courseAction({academicYearId:b.academicYearId,course:String(b.course),date:b.date.slice(0,10),periodId:b.periodId},action,this.comment));else for(const s of b.sheets)await firstValueFrom(action==='return'?this.api.returnSheet(s.id,this.comment):action==='review'?this.api.reviewSheet(s.id):this.api.closeSheet(s.id));this.details.set([]);this.selected=null;this.load();}catch(e:any){this.error.set(e.error?.message??'Не удалось изменить статус');}finally{this.busy.set(false);}}
}
