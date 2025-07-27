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
import { MatButtonModule } from '@angular/material/button';
import * as XLSX from 'xlsx';
import * as FileSaver from 'file-saver';

interface Column {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date';
}

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
    MatButtonModule,
  ],
})
export class ReportTableComponent implements OnChanges, AfterViewInit {
  @Input() title: string = 'Report';
  @Input() columns: string[] = [];
  @Input() rows: any[] = [];
  @Input() data: any = null;
  isRevenueReport: boolean = false;

  @ViewChild(MatSort) sort!: MatSort;
  dataSource = new MatTableDataSource<any>([]);
  filterText = '';
  searchTerm = '';
  selectedContract = '';
  selectedTask = '';

  // For modern template
  filteredData: any[] = [];
  currentSortColumn = '';
  sortDirection = 'asc';
  contracts: string[] = [];
  tasks: string[] = [];

  allContractCodes: string[] = [];
  allTaskCodes: string[] = [];
  selectedContractCodes: string[] = [];
  selectedTaskCodes: string[] = [];

  ngOnChanges() {
    if (this.data) {
      // Handle both old and new data structures
      if (this.data.rows) {
        this.rows = this.data.rows;
        this.columns = this.data.columns || [];
      } else if (this.data.data) {
        this.rows = this.data.data;
        this.columns = this.data.columns || [];
      } else {
        // Fallback for direct data structure
        this.rows = this.data || [];
        this.columns = Object.keys(this.rows[0] || {});
      }
    }

    // Detect if this is a revenue report (has any columns ending with Revenue and Booked Hours)
    const hasBookedHours = this.columns.some((col) =>
      col.endsWith('Booked Hours')
    );
    const hasRevenue = this.columns.some((col) => col.endsWith('Revenue'));
    this.isRevenueReport = hasBookedHours && hasRevenue;

    if (this.rows && this.columns) {
      this.addRowTotals();
      this.dataSource = new MatTableDataSource(this.rows);
      this.filteredData = [...this.rows];
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
      this.contracts = this.allContractCodes;
      this.tasks = this.allTaskCodes;

      // Reset filters
      this.selectedContractCodes = [];
      this.selectedTaskCodes = [];
      this.searchTerm = '';
      this.selectedContract = '';
      this.selectedTask = '';

      // Apply initial filters to add totals row
      this.applyFilters();
    }
  }

  ngAfterViewInit() {
    if (this.sort) {
      this.dataSource.sort = this.sort;
    }
  }

  // Modern template methods
  sortTableColumn(columnKey: string) {
    if (this.currentSortColumn === columnKey) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.currentSortColumn = columnKey;
      this.sortDirection = 'asc';
    }

    // Remove totals row before sorting
    const totalsRow = this.filteredData.find((row) => row.isSummary);
    const dataRows = this.filteredData.filter((row) => !row.isSummary);

    dataRows.sort((a, b) => {
      const aVal = a[columnKey] || 0;
      const bVal = b[columnKey] || 0;

      if (this.sortDirection === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

    // Add totals row back at the end
    this.filteredData = [...dataRows];
    if (totalsRow) {
      this.filteredData.push(totalsRow);
    }
  }

  getSortIcon(columnKey: string): string {
    if (this.currentSortColumn !== columnKey) return 'unfold_more';
    return this.sortDirection === 'asc'
      ? 'keyboard_arrow_up'
      : 'keyboard_arrow_down';
  }

  formatValue(value: any, type: string): string {
    if (type === 'number') {
      return value ? value.toLocaleString() : '0';
    }
    return value || '';
  }

  applySearch() {
    this.applyFilters();
  }

  applyFilters() {
    this.filteredData = this.rows.filter((row) => {
      // Search filter
      const searchMatch =
        !this.searchTerm ||
        Object.values(row).some(
          (val) =>
            val &&
            val.toString().toLowerCase().includes(this.searchTerm.toLowerCase())
        );

      // Contract filter
      const contractMatch =
        !this.selectedContract ||
        row['Contract Number'] === this.selectedContract;

      // Task filter
      const taskMatch =
        !this.selectedTask || row['Task Number'] === this.selectedTask;

      return searchMatch && contractMatch && taskMatch;
    });

    // Add totals row(s)
    if (this.filteredData.length > 0) {
      if (this.isRevenueReport) {
        // Two totals rows: Booked Hours and Revenue
        const bookedHoursRow: any = {
          isSummary: true,
          summaryType: 'Booked Hours',
        };
        const revenueRow: any = { isSummary: true, summaryType: 'Revenue' };
        this.displayedColumns.forEach((col) => {
          if (col.endsWith('Booked Hours')) {
            bookedHoursRow[col] = this.filteredData.reduce(
              (sum, row) => sum + (row[col] || 0),
              0
            );
            revenueRow[col] = '';
          } else if (col.endsWith('Revenue')) {
            revenueRow[col] = this.filteredData.reduce(
              (sum, row) => sum + (row[col] || 0),
              0
            );
            bookedHoursRow[col] = '';
          } else if (col === 'Booked Hours Total') {
            bookedHoursRow[col] = this.filteredData.reduce(
              (sum, row) => sum + (row['Booked Hours Total'] || 0),
              0
            );
            revenueRow[col] = '';
          } else if (col === 'Revenue Total') {
            revenueRow[col] = this.filteredData.reduce(
              (sum, row) => sum + (row['Revenue Total'] || 0),
              0
            );
            bookedHoursRow[col] = '';
          } else if (this.isSummableColumn(col)) {
            bookedHoursRow[col] = '';
            revenueRow[col] = '';
          } else {
            bookedHoursRow[col] = '';
            revenueRow[col] = '';
          }
        });
        this.filteredData.push(bookedHoursRow);
        this.filteredData.push(revenueRow);
      } else {
        // Default: single totals row
        const totalsRow: any = { isSummary: true };
        this.displayedColumns.forEach((col) => {
          if (this.isSummableColumn(col)) {
            totalsRow[col] = this.filteredData.reduce(
              (sum, row) => sum + (row[col] || 0),
              0
            );
          } else {
            totalsRow[col] = '';
          }
        });
        this.filteredData.push(totalsRow);
      }
    }
  }

  downloadExcel() {
    this.download();
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

  get displayedColumns(): string[] {
    // Add Booked Hours Total and Revenue Total columns if isRevenueReport
    if (this.isRevenueReport) {
      return [...this.columns, 'Booked Hours Total', 'Revenue Total'];
    }
    return [...this.columns, '__rowTotal'];
  }

  addRowTotals(): void {
    const summableCols = this.columns.filter(this.isSummableColumn);
    this.rows = this.rows.map((row) => {
      // Booked Hours and Revenue totals for each row
      const bookedHoursTotal = this.columns
        .filter((col) => col.endsWith('Booked Hours'))
        .reduce((sum, col) => sum + (+row[col] || 0), 0);
      const revenueTotal = this.columns
        .filter((col) => col.endsWith('Revenue'))
        .reduce((sum, col) => sum + (+row[col] || 0), 0);
      const total = summableCols.reduce(
        (sum, col) => sum + (+row[col] || 0),
        0
      );
      return {
        ...row,
        __rowTotal: total,
        'Booked Hours Total': bookedHoursTotal,
        'Revenue Total': revenueTotal,
      };
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

  download() {
    // Use filteredData, which includes summary rows and new total columns
    const exportRows = this.filteredData.map((row) => {
      // For summary rows, keep as is; for normal rows, add Total columns if needed
      if (row.isSummary) {
        return row;
      } else {
        // Add row total columns for Revenue reports
        if (this.isRevenueReport) {
          return {
            ...row,
            'Booked Hours Total': row['Booked Hours Total'],
            'Revenue Total': row['Revenue Total'],
          };
        } else {
          return {
            ...row,
            __rowTotal: row['__rowTotal'],
          };
        }
      }
    });

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
