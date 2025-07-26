import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';
import { ReportTableComponent } from './report-table/report-table.component';
import { MatCardModule } from '@angular/material/card';
import * as XLSX from 'xlsx';
import * as FileSaver from 'file-saver';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-reports',
  templateUrl: './reports.component.html',
  styleUrls: ['./reports.component.scss'],
  imports: [
    CommonModule,
    MatTabsModule,
    ReportTableComponent,
    MatCardModule,
    MatIconModule,
  ],
})
export class ReportsComponent {
  @Input() data: any;

  downloadExcel(label: string, columns: string[], rows: any[]) {
    const worksheet = XLSX.utils.json_to_sheet(rows, { header: columns });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, label);

    const excelBuffer: any = XLSX.write(workbook, {
      bookType: 'xlsx',
      type: 'array',
    });
    const blob = new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    FileSaver.saveAs(blob, `${label}_Report.xlsx`);
  }
}
