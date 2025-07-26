import { Component, OnInit } from '@angular/core';
import {
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ApiService } from '../services/api.service';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatTableModule } from '@angular/material/table';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import * as XLSX from 'xlsx';

@Component({
  selector: 'app-rph-maintenance',
  templateUrl: './rph-maintenance.component.html',
  styleUrls: ['./rph-maintenance.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatInputModule,
    MatTableModule,
    MatSnackBarModule,
  ],
})
export class RphMaintenanceComponent implements OnInit {
  form: FormGroup;
  displayedColumns = [
    'contract_code',
    'contract_name',
    'task_code',
    'rph',
    'actions',
  ];

  highlightMap = new WeakMap<FormGroup, boolean>();
  dragOver = false;

  constructor(
    private fb: FormBuilder,
    private apiService: ApiService,
    private snackBar: MatSnackBar
  ) {
    this.form = this.fb.group({ rows: this.fb.array([]) });
  }

  ngOnInit(): void {
    this.apiService.getRPH().subscribe((data: any[]) => {
      const rowsArray = data.map((row) => {
        const group = this.fb.group({
          id: [row.id],
          contract_code: [row.contract_code, Validators.required],
          contract_name: [row.contract_name, Validators.required],
          task_code: [row.task_code, Validators.required],
          rph: [row.rph, [Validators.required, Validators.min(1)]],
        });

        group.valueChanges.subscribe(() => {
          this.highlightMap.set(group, true);
        });

        return group;
      });

      this.form.setControl('rows', this.fb.array(rowsArray));
    });
  }

  get rows(): FormArray {
    return this.form.get('rows') as FormArray;
  }

  addRow(): void {
    const group = this.fb.group({
      contract_code: ['', Validators.required],
      contract_name: ['', Validators.required],
      task_code: ['', Validators.required],
      rph: [0, [Validators.required, Validators.min(1)]],
    });

    group.valueChanges.subscribe(() => {
      this.highlightMap.set(group, true);
    });

    this.rows.push(group);
  }

  removeRow(index: number): void {
    const id = this.rows.at(index).get('id')?.value;
    if (id) {
      this.apiService.deleteRPH(id).subscribe(() => {
        this.rows.removeAt(index);
      });
    } else {
      this.rows.removeAt(index);
    }
  }

  saveAll(): void {
    const existing = this.rows.controls.filter((r) => r.value.id);
    const created = this.rows.controls.filter((r) => !r.value.id);

    const updateRequests = existing.map((ctrl) =>
      this.apiService.updateRPH(ctrl.value.id, ctrl.value)
    );

    const createPayload = created.map((ctrl) => {
      const val = ctrl.value;
      return {
        contract_code: String(val.contract_code || '').trim(),
        contract_name: String(val.contract_name || '').trim(),
        task_code: String(val.task_code || '').trim(),
        rph: Number(val.rph) || 0,
      };
    });

    const createReq = createPayload.length
      ? this.apiService.saveRPH(createPayload)
      : null;

    Promise.all([
      ...(createReq ? [createReq.toPromise()] : []),
      ...updateRequests.map((req) => req.toPromise()),
    ])
      .then(() => {
        this.snackBar.open('All records saved successfully ✅', 'Close', {
          duration: 3000,
        });
        this.highlightMap = new WeakMap<FormGroup, boolean>(); // clear all highlights
        this.ngOnInit(); // reload data
      })
      .catch(() => {
        this.snackBar.open('Failed to save some records ❌', 'Close', {
          duration: 3000,
        });
      });
  }

  downloadTemplate(): void {
    const headers = ['Contract Code', 'Contract Name', 'Task Code', 'RPH'];
    const worksheet = XLSX.utils.aoa_to_sheet([headers]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'RPH_Template');
    XLSX.writeFile(workbook, 'RPH_Upload_Template.xlsx');
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragOver = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.dragOver = false;
  }

  onFileDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOver = false;
    const files = event.dataTransfer?.files;
    if (files?.length) this.readExcel(files[0]);
  }

  handleFileUpload(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    this.readExcel(input.files[0]);
  }

  readExcel(file: File): void {
    const reader = new FileReader();

    reader.onload = (e: any) => {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet);

      rows.forEach((row: any) => {
        const contractCode = String(row['Contract Code']).trim();
        const taskCode = String(row['Task Code']).trim();

        const existingIndex = this.rows.controls.findIndex((ctrl) => {
          const ctrlVal = ctrl.value;
          return (
            ctrlVal.contract_code?.trim() === contractCode &&
            ctrlVal.task_code?.trim() === taskCode
          );
        });

        const newData = {
          contract_code: contractCode,
          contract_name: String(row['Contract Name'] || '').trim(),
          task_code: taskCode,
          rph: Number(row['RPH']) || 0,
        };

        if (existingIndex !== -1) {
          const existingCtrl = this.rows.at(existingIndex) as FormGroup;
          existingCtrl.patchValue(newData);
          this.highlightMap.set(existingCtrl, true);
        } else {
          const group = this.fb.group({
            contract_code: [newData.contract_code, Validators.required],
            contract_name: [newData.contract_name, Validators.required],
            task_code: [newData.task_code, Validators.required],
            rph: [newData.rph, [Validators.required, Validators.min(1)]],
          });

          group.valueChanges.subscribe(() => {
            this.highlightMap.set(group, true);
          });

          this.rows.push(group);
          this.highlightMap.set(group, true);
        }
      });
    };

    reader.readAsArrayBuffer(file);
  }

  downloadExcel(): void {
    const rows = this.rows.value.map((r: any) => ({
      'Contract Code': r.contract_code,
      'Contract Name': r.contract_name,
      'Task Code': r.task_code,
      RPH: r.rph,
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'RPH Master');
    XLSX.writeFile(workbook, 'RPH_Master.xlsx');
  }
}
