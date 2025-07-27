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
    const totalsRow = this.filteredData.find(row => row.isSummary);
    const dataRows = this.filteredData.filter(row => !row.isSummary);
    
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
    return this.sortDirection === 'asc' ? 'keyboard_arrow_up' : 'keyboard_arrow_down';
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
    this.filteredData = this.rows.filter(row => {
      // Search filter
      const searchMatch = !this.searchTerm || 
        Object.values(row).some(val => 
          val && val.toString().toLowerCase().includes(this.searchTerm.toLowerCase())
        );
      
      // Contract filter
      const contractMatch = !this.selectedContract || 
        row['Contract Number'] === this.selectedContract;
      
      // Task filter
      const taskMatch = !this.selectedTask || 
        row['Task Number'] === this.selectedTask;
      
      return searchMatch && contractMatch && taskMatch;
    });
    
    // Add totals row
    if (this.filteredData.length > 0) {
      const totalsRow: any = { isSummary: true };
      this.displayedColumns.forEach(col => {
        if (this.isSummableColumn(col)) {
          totalsRow[col] = this.filteredData.reduce((sum, row) => sum + (row[col] || 0), 0);
        } else {
          totalsRow[col] = '';
        }
      });
      this.filteredData.push(totalsRow);
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
