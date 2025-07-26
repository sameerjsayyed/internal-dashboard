import { Component, OnInit } from '@angular/core';
import { HttpEventType } from '@angular/common/http';
import { ApiService, UploadHistory, ReportData } from '../services/api.service';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { ReportsComponent } from '../reports/reports.component';

@Component({
  selector: 'app-upload',
  templateUrl: './upload.component.html',
  styleUrls: ['./upload.component.scss'],
  imports: [
    ReportsComponent,
    CommonModule,
    MatCardModule,
    DragDropModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatIconModule,
  ],
})
export class UploadComponent implements OnInit {
  file!: File;
  reports: ReportData | null = null;
  latestUpload: UploadHistory | null = null;

  dragOver = false;
  uploading = false;
  uploadProgress = 0;

  constructor(private apiService: ApiService) {}

  ngOnInit(): void {
    this.fetchLatestUpload();
  }

  fetchLatestUpload() {
    this.apiService.getLatestUpload().subscribe({
      next: (upload) => {
        if (!upload) {
          console.warn('No uploads found.');
          return;
        }
        this.latestUpload = upload;
        this.loadReportData(upload.id);
      },
      error: () => {
        console.warn('No recent upload found.');
      },
    });
  }

  loadReportData(id: number) {
    this.apiService.getUploadById(id).subscribe({
      next: (data) => {
        this.reports = data;
      },
      error: () => {
        alert('Failed to load report for latest upload.');
      },
    });
  }

  onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.file = input.files[0];
    }
  }

  handleDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragOver = true;
  }

  handleDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.dragOver = false;
  }

  handleDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOver = false;
    const files = event.dataTransfer?.files;
    if (files?.length) {
      const droppedFile = files[0];
      if (
        !droppedFile.name.endsWith('.xls') &&
        !droppedFile.name.endsWith('.xlsx')
      ) {
        alert('Only .xls or .xlsx files are allowed.');
        return;
      }
      this.file = droppedFile;
      this.upload();
    }
  }

  upload(): void {
    if (!this.file) return;

    const formData = new FormData();
    formData.append('file', this.file);

    this.uploading = true;
    this.uploadProgress = 0;

    this.apiService.uploadFile(formData).subscribe({
      next: (event) => {
        if (event.type === HttpEventType.UploadProgress && event.total) {
          this.uploadProgress = Math.round(100 * (event.loaded / event.total));
        }
        if (event.type === HttpEventType.Response) {
          this.reports = event.body as ReportData;
          this.uploading = false;
          this.uploadProgress = 100;
          this.fetchLatestUpload(); // refresh latest metadata
        }
      },
      error: (err) => {
        alert(err?.error?.detail || 'Upload failed');
        this.uploading = false;
      },
    });
  }
}
