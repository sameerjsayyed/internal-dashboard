import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CommonModule, DatePipe } from '@angular/common';
import { ReportsComponent } from '../reports/reports.component';

@Component({
  selector: 'app-upload',
  templateUrl: './upload.component.html',
  styleUrls: ['./upload.component.scss'],
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatCardModule,
    MatProgressSpinnerModule,
    DatePipe,
    ReportsComponent
  ],
  standalone: true
})
export class UploadComponent implements OnInit {
  selectedFile: File | null = null;
  uploading = false;
  isDragOver = false;
  uploadedFile: any = null;
  reports: any = null;

  constructor(
    private http: HttpClient,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    // Load last uploaded file info
    this.loadLastUploadedFile();
    // Load reports data
    this.loadReports();
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;
    
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.selectedFile = files[0];
    }
  }

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      this.selectedFile = file;
    }
  }

  uploadFile(): void {
    if (!this.selectedFile) {
      this.snackBar.open('Please select a file first', 'Close', { duration: 3000 });
      return;
    }

    this.uploading = true;
    const formData = new FormData();
    formData.append('file', this.selectedFile);

    this.http.post('http://localhost:8000/upload', formData).subscribe({
      next: (response: any) => {
        this.uploading = false;
        this.uploadedFile = {
          name: this.selectedFile?.name,
          uploadDate: new Date()
        };
        this.snackBar.open('File uploaded successfully!', 'Close', { duration: 3000 });
        this.selectedFile = null;
        // Set reports data from upload response
        this.reports = response;
      },
      error: (error) => {
        this.uploading = false;
        this.snackBar.open('Upload failed. Please try again.', 'Close', { duration: 3000 });
        console.error('Upload error:', error);
      }
    });
  }

  private loadLastUploadedFile(): void {
    // Load last uploaded file info from API
    this.http.get('http://localhost:8000/history/latest').subscribe({
      next: (response: any) => {
        if (response && response.file_name) {
          this.uploadedFile = {
            name: response.file_name,
            uploadDate: new Date(response.uploaded_at)
          };
        }
      },
      error: (error) => {
        console.error('Error loading last uploaded file:', error);
      }
    });
  }

  private loadReports(): void {
    // Load reports data from latest upload
    this.http.get('http://localhost:8000/history/latest').subscribe({
      next: (response: any) => {
        if (response && response.id) {
          // Get the report data for the latest upload
          this.http.get(`http://localhost:8000/history/${response.id}`).subscribe({
            next: (reportData: any) => {
              this.reports = reportData;
            },
            error: (error) => {
              console.error('Error loading report data:', error);
            }
          });
        }
      },
      error: (error) => {
        console.error('Error loading latest upload:', error);
      }
    });
  }
}
