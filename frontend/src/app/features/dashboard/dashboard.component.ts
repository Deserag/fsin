import { Component } from '@angular/core';
import { ReportsComponent } from '../admin/reports/reports.component';
@Component({selector:'app-dashboard',standalone:true,imports:[ReportsComponent],templateUrl:'./dashboard.component.html',styleUrl:'./dashboard.component.scss'})
export class DashboardComponent {}
