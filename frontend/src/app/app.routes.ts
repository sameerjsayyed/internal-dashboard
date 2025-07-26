import { Routes } from '@angular/router';
import { UploadComponent } from './upload/upload.component';
import { PastReportsComponent } from './reports/past-reports/past-reports.component';
import { RphMaintenanceComponent } from './rph-maintenance/rph-maintenance.component';
import { RevenueReportComponent } from './revenue-report/revenue-report.component';

export const routes: Routes = [
  { path: '', redirectTo: 'upload', pathMatch: 'full' },
  { path: 'upload', component: UploadComponent },
  { path: 'history', component: PastReportsComponent },
  { path: 'rph-maintenance', component: RphMaintenanceComponent },
  { path: 'revenue-report', component: RevenueReportComponent }, // ✅ new
];
