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
    FormsModule
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

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.http.get<any[]>('http://localhost:8000/history').subscribe({
      next: (data) => {
        this.dataSource = data;
        this.filteredDataSource = data;
      },
      error: () => alert('Could not load history from server'),
    });
  }

  ngOnChanges() {
    this.applySearch();
  }

  applySearch() {
    if (!this.searchTerm) {
      this.filteredDataSource = this.dataSource;
    } else {
      this.filteredDataSource = this.dataSource.filter(item =>
        item.file_name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        item.file_size_kb.toString().includes(this.searchTerm) ||
        item.uploaded_at.toLowerCase().includes(this.searchTerm.toLowerCase())
      );
    }
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
