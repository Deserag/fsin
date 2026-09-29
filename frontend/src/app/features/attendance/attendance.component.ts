import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { forkJoin, firstValueFrom } from 'rxjs';
import { AttendanceService } from '../../core/services/attendance.service';
import { ReferenceDataService } from '../../core/services/reference-data.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../shared/services/toast.service';
import { AttendanceSheetDetail } from '../../core/models/attendance.model';
interface Row {sheetId:string;studentId:string;name:string;groupName:string;gender:string|null;isPresent:boolean|null;reasonId:string|null;note:string;selected:boolean;dirty:boolean;}
@Component({selector:'app-attendance',standalone:true,imports:[CommonModule,FormsModule],templateUrl:'./attendance.component.html',styleUrl:'./attendance.component.scss'})
export class AttendanceComponent implements OnInit {
 readonly loading=signal(false);readonly saving=signal(false);readonly error=signal('');readonly years=signal<any[]>([]);readonly periods=signal<any[]>([]);readonly reasons=signal<any[]>([]);readonly sheets=signal<AttendanceSheetDetail[]>([]);readonly rows=signal<Row[]>([]);readonly search=signal('');
 readonly academicYearId=signal('');readonly course=signal(1);readonly periodId=signal('');readonly date=signal(new Date().toLocaleDateString('en-CA'));
 readonly selectedCount=computed(()=>this.rows().filter(r=>r.selected).length);readonly allSelected=computed(()=>this.rows().length>0&&this.rows().every(r=>r.selected));
 readonly totals=computed(()=>({total:this.rows().length,present:this.rows().filter(r=>r.isPresent===true).length,absent:this.rows().filter(r=>r.isPresent===false).length,unmarked:this.rows().filter(r=>r.isPresent===null)}));
 readonly rosterColumns=[
  {code:'DUTY_DETAIL',label:'Наряд'},{code:'REGIME_POST',label:'Пост. режим'},{code:'INFIRMARY',label:'Лазарет'},{code:'IN_FORMATION',label:'В строю'},
  {code:'ZUB',label:'ЗУБ'},{code:'VACATION',label:'Отпуск'},{code:'HOSPITAL',label:'Госпиталь'},{code:'HOME_TREATMENT',label:'Дом. лечение'},
  {code:'DISMISSAL',label:'Увольнение'},{code:'BUSINESS_TRIP',label:'Командировка'},{code:'WITHOUT_UP',label:'Без УП'},{code:'PRACTICE',label:'Практика'},
 ];
 readonly rosterSummary=computed(()=>{const rows=this.rows(),codeById=new Map(this.reasons().map(r=>[r.id,r.code]));const byCode:Partial<Record<string,number>>={};for(const row of rows){const code=codeById.get(row.reasonId);if(code)byCode[code]=(byCode[code]??0)+1;}return {total:rows.length,female:rows.filter(r=>r.gender==='FEMALE').length,genderUnknown:rows.filter(r=>!r.gender).length,inside:rows.filter(r=>r.isPresent===true).length,outside:rows.filter(r=>r.isPresent===false).length,byCode};});
 readonly dirty=computed(()=>this.rows().some(r=>r.dirty));
 readonly valid=computed(()=>this.rows().length>0&&this.rows().every(r=>r.isPresent!==null&&(r.isPresent||!!r.reasonId&&(!this.reasons().find(x=>x.id===r.reasonId)?.requiresNote||!!r.note.trim()))));
 readonly canSubmit=computed(()=>this.sheets().length>0&&this.sheets().every(s=>['DRAFT','FILLED'].includes(s.status)));
 private detailId:string|null=null;
 constructor(private api:AttendanceService,private ref:ReferenceDataService,readonly auth:AuthService,private route:ActivatedRoute,private toast:ToastService){}
 ngOnInit(){this.detailId=this.route.snapshot.queryParamMap.get('sheetId');forkJoin({years:this.ref.academicYears(),periods:this.api.periods(),reasons:this.api.reasons()}).subscribe({next:({years,periods,reasons})=>{this.years.set(years);this.periods.set(periods.filter((p:any)=>p.isActive!==false));this.reasons.set(reasons);this.academicYearId.set(years.find(y=>y.isCurrent)?.id??years[0]?.id??'');this.periodId.set(this.periods()[0]?.id??'');if(this.detailId)this.openDetail(this.detailId);else this.load();},error:e=>this.error.set(e.error?.message??'Не удалось загрузить справочники')});}
 context(){return {academicYearId:this.academicYearId(),course:String(this.course()),date:this.date(),periodId:this.periodId()};}
 selectedPeriodLabel(){const period=this.periods().find(p=>p.id===this.periodId());return period?.startTime ? `${period.name} · ${period.startTime}` : period?.name??'';}
 private apply(sheets:AttendanceSheetDetail[]){this.sheets.set(sheets);this.rows.set(sheets.flatMap(s=>s.records.map(r=>({sheetId:s.id,studentId:r.studentId,name:`${r.student.lastName} ${r.student.firstName} ${r.student.middleName??''}`,groupName:s.group?.name??'',gender:r.student.gender??null,isPresent:r.isPresent,reasonId:r.reasonId??null,note:r.note??'',selected:false,dirty:false}))));}
 async load(create=false){if(this.dirty()){this.error.set('Сначала сохраните изменения');return;}this.detailId=null;this.loading.set(true);this.error.set('');try{this.apply(await firstValueFrom(this.api.course(this.context(),create)));}catch(e:any){this.error.set(e.error?.message??'Не удалось открыть табели');}finally{this.loading.set(false);}}
 async openDetail(id:string){this.loading.set(true);try{const sheet=await firstValueFrom(this.api.getSheet(id));this.date.set(sheet.date.slice(0,10));this.periodId.set(sheet.periodId);if(sheet.courseSnapshot)this.course.set(sheet.courseSnapshot);this.apply([sheet]);}catch(e:any){this.error.set(e.error?.message??'Нет доступа');}finally{this.loading.set(false);}}
 visibleRows(sheetId:string){return this.rows().filter(r=>r.sheetId===sheetId&&r.name.toLowerCase().includes(this.search().toLowerCase()));}
 editable(sheetId:string){const status=this.sheets().find(s=>s.id===sheetId)?.status;return this.auth.hasPermission('ATTENDANCE_WRITE')&&(status==='DRAFT'||status==='FILLED'||this.auth.hasPermission('ATTENDANCE_CORRECT'));}
 select(row:Row){this.rows.update(rows=>rows.map(r=>r===row?{...r,selected:!r.selected}:r));}
 selectAll(){const selected=!this.allSelected();this.rows.update(rows=>rows.map(r=>({...r,selected})));}
 rowClick(event:MouseEvent,row:Row){if((event.target as HTMLElement).closest('button,input,select,textarea,a'))return;this.select(row);}
 reasonOptions(isPresent:boolean){return this.reasons().filter(r=>r.category===(isPresent?'IN_INSTITUTE':'OUTSIDE')&&r.isActive!==false);}
 private formationReasonId(){return this.reasons().find(r=>r.code==='IN_FORMATION')?.id??null;}
 mark(row:Row,value:boolean|null,reasonId?:string,note?:string){if(!this.editable(row.sheetId))return;const selected=reasonId!==undefined?reasonId||null:(value?(row.isPresent===true?row.reasonId:null)??this.formationReasonId():row.isPresent===false?row.reasonId:null);this.rows.update(rows=>rows.map(r=>r===row?{...r,isPresent:value,reasonId:selected,note:note??r.note,dirty:true}:r));}
 bulk(value:boolean,reasonId?:string){this.rows.update(rows=>rows.map(r=>r.selected&&this.editable(r.sheetId)?{...r,isPresent:value,reasonId:value?this.formationReasonId():reasonId??null,dirty:true}:r));}
 async save(){this.saving.set(true);this.error.set('');try{for(const sheet of this.sheets()){const dirty=this.rows().filter(r=>r.sheetId===sheet.id&&r.dirty);if(!dirty.length)continue;await firstValueFrom(this.api.bulkUpdate(sheet.id,dirty.map(r=>({studentId:r.studentId,isPresent:r.isPresent,reasonId:r.reasonId??undefined,note:r.note}))));this.rows.update(rows=>rows.map(r=>r.sheetId===sheet.id?{...r,dirty:false}:r));}this.toast.success('Изменения сохранены');if(this.detailId)await this.openDetail(this.detailId);else await this.load();}catch(e:any){this.error.set(e.error?.message??'Не удалось сохранить');}finally{this.saving.set(false);}}
 async submit(){if(this.dirty()){this.error.set('Сохраните изменения перед отправкой');return;}this.saving.set(true);try{if(this.detailId)await firstValueFrom(this.api.submitSheet(this.detailId));else await firstValueFrom(this.api.courseAction(this.context(),'submit'));this.toast.success('Табели отправлены на проверку');if(this.detailId)await this.openDetail(this.detailId);else await this.load();}catch(e:any){this.error.set(e.error?.message??'Не удалось отправить');}finally{this.saving.set(false);}}
 statusLabel(status:string){return ({DRAFT:'Черновик',FILLED:'Заполнен',SUBMITTED:'На проверке',REVIEWED:'Проверен',CLOSED:'Закрыт'} as any)[status]??status;}
}
