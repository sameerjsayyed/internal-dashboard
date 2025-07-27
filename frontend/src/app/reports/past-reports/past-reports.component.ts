import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTabsModule } from '@angular/material/tabs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatSortModule } from '@angular/material/sort';

@Component({
  standalone: true,
  selector: 'app-past-reports',
  templateUrl: './past-reports.component.html',
  styleUrls: ['./past-reports.component.scss'],
  imports: [
    CommonModule, 
    MatCardModule, 
    MatTableModule, 
    MatIconModule, 
    MatButtonModule,
    MatTabsModule,
    MatFormFieldModule,
    MatInputModule,
    FormsModule,
    MatSortModule
  ],
})
export class PastReportsComponent implements OnInit {
  displayedColumns: string[] = [
    'file_name',
    'file_size_kb',
    'uploaded_at',
    'actions',
  ];
  dataSource: any[] = [];
  filteredDataSource: any[] = [];
  searchTerm: string = '';
  currentSortColumn: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.http.get<any[]>('http://localhost:8000/history').subscribe({
      next: (data) => {
        this.dataSource = data;
        this.filteredDataSource = [...data];
      },
      error: () => alert('Could not load history from server'),
    });
  }

  ngOnChanges() {
    this.applySearch();
  }

  applySearch() {
    if (!this.searchTerm) {
      this.filteredDataSource = [...this.dataSource];
    } else {
      this.filteredDataSource = this.dataSource.filter(item =>
        item.file_name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        item.file_size_kb.toString().includes(this.searchTerm) ||
        item.uploaded_at.toLowerCase().includes(this.searchTerm.toLowerCase())
      );
    }
    this.applySort();
  }

  sortTableColumn(column: string) {
    if (this.currentSortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.currentSortColumn = column;
      this.sortDirection = 'asc';
    }
    this.applySort();
  }

  applySort() {
    if (!this.currentSortColumn) return;

    // Create a new array to trigger change detection
    this.filteredDataSource = [...this.filteredDataSource].sort((a, b) => {
      let aValue = a[this.currentSortColumn];
      let bValue = b[this.currentSortColumn];

      // Handle null/undefined values
      if (aValue === null || aValue === undefined) aValue = '';
      if (bValue === null || bValue === undefined) bValue = '';

      if (this.currentSortColumn === 'uploaded_at') {
        aValue = new Date(aValue);
        bValue = new Date(bValue);
      } else if (this.currentSortColumn === 'file_size_kb') {
        aValue = parseInt(aValue) || 0;
        bValue = parseInt(bValue) || 0;
      } else {
        aValue = String(aValue).toLowerCase();
        bValue = String(bValue).toLowerCase();
      }

      if (aValue < bValue) {
        return this.sortDirection === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return this.sortDirection === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }

  getSortIcon(column: string): string {
    if (this.currentSortColumn !== column) {
      return 'unfold_more';
    }
    return this.sortDirection === 'asc' ? 'keyboard_arrow_up' : 'keyboard_arrow_down';
  }

  deleteOne(id: number) {
    if (!confirm('Delete this record?')) return;
    this.http.delete(`http://localhost:8000/history/${id}`).subscribe(() => {
      this.dataSource = this.dataSource.filter((row) => row.id !== id);
      this.applySearch();
    });
  }

  clearAll() {
    if (!confirm('Clear all upload history?')) return;
    this.http.delete('http://localhost:8000/history').subscribe(() => {
      this.dataSource = [];
      this.filteredDataSource = [];
    });
  }
}
