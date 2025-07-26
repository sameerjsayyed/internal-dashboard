import {
  Component,
  Input,
  OnChanges,
  AfterViewInit,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import * as XLSX from 'xlsx';
import * as FileSaver from 'file-saver';

@Component({
  selector: 'app-report-table',
  standalone: true,
  templateUrl: './report-table.component.html',
  styleUrls: ['./report-table.component.scss'],
  imports: [
    MatTableModule,
    CommonModule,
    MatSortModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    FormsModule,
    MatSelectModule,
  ],
})
export class ReportTableComponent implements OnChanges, AfterViewInit {
  @Input() title: string = 'Report';
  @Input() columns: string[] = [];
  @Input() rows: any[] = [];
  @ViewChild(MatSort) sort!: MatSort;
  dataSource = new MatTableDataSource<any>([]);
  filterText = '';

  allContractCodes: string[] = [];
  allTaskCodes: string[] = [];
  selectedContractCodes: string[] = [];
  selectedTaskCodes: string[] = [];

  ngOnChanges() {
    if (this.rows && this.columns) {
      this.addRowTotals();
      this.dataSource = new MatTableDataSource(this.rows);
      this.dataSource.filterPredicate = (data, filter) =>
        this.displayedColumns.some((col) =>
          (data[col] || '').toString().toLowerCase().includes(filter)
        );
      this.dataSource.sort = this.sort;
      this.allContractCodes = Array.from(
        new Set(this.rows.map((r) => r['Contract Number']))
      );
      this.allTaskCodes = Array.from(
        new Set(this.rows.map((r) => r['Task Number']))
      );

      // Reset filters
      this.selectedContractCodes = [];
      this.selectedTaskCodes = [];
    }
  }

  ngAfterViewInit() {
    if (this.sort) {
      this.dataSource.sort = this.sort;
    }
  }
  applyFilter() {
    this.dataSource.filterPredicate = (row, _) => {
      const contractMatch =
        this.selectedContractCodes.length === 0 ||
        this.selectedContractCodes.includes(row['Contract Number']);

      const taskMatch =
        this.selectedTaskCodes.length === 0 ||
        this.selectedTaskCodes.includes(row['Task Number']);

      // Also apply text filter if present
      const textMatch = this.filterText
        ? this.displayedColumns.some((col) =>
            (row[col] || '')
              .toString()
              .toLowerCase()
              .includes(this.filterText.trim().toLowerCase())
          )
        : true;

      return contractMatch && taskMatch && textMatch;
    };

    // Setting filter to trigger filterPredicate
    this.dataSource.filter = Math.random().toString();
  }

  get fixedColumns(): string[] {
    return this.columns.filter((col) => !col.includes('|'));
  }

  get columnTotals(): { [key: string]: number } {
    const totals: { [key: string]: number } = {};
    const summableCols = this.columns.filter(this.isSummableColumn);

    summableCols.push('__rowTotal');
    summableCols.forEach((col) => {
      totals[col] = this.dataSource.filteredData.reduce(
        (sum, row) => sum + (+row[col] || 0),
        0
      );
    });

    return totals;
  }

  getRowTotalOfTotals(): number {
    return this.columnTotals['__rowTotal'] || 0;
  }

  addRowTotals(): void {
    const summableCols = this.columns.filter(this.isSummableColumn);
    this.rows = this.rows.map((row) => {
      const total = summableCols.reduce(
        (sum, col) => sum + (+row[col] || 0),
        0
      );
      return { ...row, __rowTotal: total };
    });
  }

  isSummableColumn(col: string): boolean {
    return (
      col === 'Revenue' ||
      col === 'Booked Hours' ||
      col === '__rowTotal' ||
      /^\w{3}-\d{4}$/.test(col) ||
      /^Q\d \(.+\) \d{4}$/.test(col)
    );
  }

  get displayedColumns(): string[] {
    return [...this.columns, '__rowTotal'];
  }

  get finalDisplayedColumns(): string[] {
    return [...this.columns, '__rowTotal'];
  }

  download() {
    const filteredRows = this.dataSource.filteredData;

    const rowsWithTotal = filteredRows.map((row) => {
      const total = this.displayedColumns
        .filter(this.isSummableColumn)
        .reduce((sum, c) => sum + (+row[c] || 0), 0);
      return { ...row, Total: total };
    });

    const columnTotals: any = {};
    this.displayedColumns.forEach((c) => {
      if (c.includes('|') || c === '__rowTotal') {
        columnTotals[c] = this.columnTotals[c] || 0;
      } else {
        columnTotals[c] = '';
      }
    });

    const exportRows = [...rowsWithTotal, columnTotals];

    const worksheet = XLSX.utils.json_to_sheet(exportRows, {
      header: this.displayedColumns,
    });

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, this.title);

    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    FileSaver.saveAs(blob, `${this.title}_Report.xlsx`);
  }

  isNumeric(val: any): boolean {
    return !isNaN(parseFloat(val));
  }
}
