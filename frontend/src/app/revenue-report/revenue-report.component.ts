import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReportTableComponent } from '../reports/report-table/report-table.component';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { ApiService } from '../services/api.service';
import * as XLSX from 'xlsx';

@Component({
  selector: 'app-revenue-report',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatTabsModule,
    ReportTableComponent,
    MatIconModule,
  ],
  templateUrl: './revenue-report.component.html',
  styleUrls: ['./revenue-report.component.scss'],
})
export class RevenueReportComponent implements OnInit {
  loading = true;
  error = false;
  data: any = null;

  constructor(private apiService: ApiService) {}

  ngOnInit(): void {
    this.apiService.getLatestRevenue().subscribe({
      next: (res) => {
        this.data = res;
        this.loading = false;
      },
      error: () => {
        this.error = true;
        this.loading = false;
      },
    });
  }

  downloadRevenueSheet(label: string, columns: string[], rows: any[]): void {
    const worksheet = XLSX.utils.json_to_sheet(rows, { header: columns });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, label);
    XLSX.writeFile(workbook, `${label}_Revenue.xlsx`);
  }
}
