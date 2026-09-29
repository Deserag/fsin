import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReferenceDataService } from '../../../core/services/reference-data.service';
import { ToastService } from '../../../shared/services/toast.service';
import { ConfirmService } from '../../../shared/services/confirm.service';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
@Component({selector:'app-reference-data',standalone:true,imports:[CommonModule,FormsModule,ModalComponent],templateUrl:'./reference-data.component.html',styleUrl:'./reference-data.component.scss'})
export class ReferenceDataComponent implements OnInit {
 readonly tabs=[{key:'programs',label:'Образовательные программы'},{key:'academic-years',label:'Учебные годы'},{key:'settings/student-statuses',label:'Статусы студентов'},{key:'settings/attendance-periods',label:'Периоды учета'},{key:'attendance-reasons',label:'Причины отсутствия'}];
 readonly activeTab=signal('programs'); readonly rows=signal<any[]>([]); readonly loading=signal(false); readonly modalOpen=signal(false); readonly saving=signal(false); readonly form=signal<any>({});
 constructor(private ref:ReferenceDataService,private toast:ToastService,private confirm:ConfirmService){}
 ngOnInit(){this.load();}
 load(){this.loading.set(true);this.ref.listReference(this.activeTab()).subscribe({next:rows=>{this.rows.set(rows);this.loading.set(false);},error:e=>{this.loading.set(false);this.toast.error(e.error?.message??'Не удалось загрузить справочник');}});}
 setTab(key:string){this.activeTab.set(key);this.load();}
 openCreate(){this.form.set({isActive:true,countsInAttendance:true,durationYears:5,category:'OUTSIDE'});this.modalOpen.set(true);}
 edit(row:any){this.form.set({...row,startDate:row.startDate?.slice(0,10),endDate:row.endDate?.slice(0,10)});this.modalOpen.set(true);}
 updateForm(key:string,value:any){this.form.update((f:any)=>({...f,[key]:value}));}
 save(){const f=this.form(), path=this.activeTab(); const keys=path==='academic-years'?['name','startDate','endDate']:path==='programs'?['code','name','shortName','durationYears','educationForm','specialization']:path==='settings/student-statuses'?['code','name','isTerminal','countsInAttendance']:path==='settings/attendance-periods'?['code','name','startTime','endTime']:['code','name','category','requiresNote']; const dto:any={};for(const k of keys)if(f[k]!==undefined)dto[k]=f[k];this.saving.set(true);this.ref.saveReference(path,dto,f.id).subscribe({next:()=>{this.saving.set(false);this.modalOpen.set(false);this.load();},error:e=>{this.saving.set(false);this.toast.error(e.error?.message??'Не удалось сохранить');}});}
 toggle(row:any){this.ref.saveReference(this.activeTab(),{isActive:!row.isActive},row.id).subscribe({next:()=>this.load(),error:e=>this.toast.error(e.error?.message??'Не удалось изменить статус')});}
 async remove(row:any){if(!await this.confirm.ask({title:'Удалить запись?',message:'Используемую запись можно только архивировать.',confirmLabel:'Удалить',danger:true}))return;this.ref.deleteReference(this.activeTab(),row.id).subscribe({next:()=>this.load(),error:e=>this.toast.error(e.error?.message??'Запись используется; архивируйте её')});}
 setCurrentYear(id:string){this.ref.setCurrentAcademicYear(id).subscribe({next:()=>this.load(),error:e=>this.toast.error(e.error?.message??'Не удалось активировать год')});}
}
