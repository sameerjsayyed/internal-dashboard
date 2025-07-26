import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { HttpClient } from '@angular/common/http';

@Component({
  standalone: true,
  selector: 'app-past-reports',
  templateUrl: './past-reports.component.html',
  styleUrls: ['./past-reports.component.scss'],
  imports: [CommonModule, MatCardModule, MatTableModule, MatIconModule],
})
export class PastReportsComponent implements OnInit {
  displayedColumns: string[] = [
    'file_name',
    'file_size_kb',
    'uploaded_at',
    'actions',
  ];
  dataSource: any[] = [];

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.http.get<any[]>('http://localhost:8000/history').subscribe({
      next: (data) => {
        this.dataSource = data;
      },
      error: () => alert('Could not load history from server'),
    });
  }

  deleteOne(id: number) {
    if (!confirm('Delete this record?')) return;
    this.http.delete(`http://localhost:8000/history/${id}`).subscribe(() => {
      this.dataSource = this.dataSource.filter((row) => row.id !== id);
    });
  }

  clearAll() {
    if (!confirm('Clear all upload history?')) return;
    this.http.delete('http://localhost:8000/history').subscribe(() => {
      this.dataSource = [];
    });
  }
}
