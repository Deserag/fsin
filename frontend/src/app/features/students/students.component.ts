import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StudentsService } from '../../core/services/students.service';
import { Student } from '../../core/models/student.model';

@Component({
  selector: 'app-students',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './students.component.html',
  styleUrl: './students.component.scss',
})
export class StudentsComponent implements OnInit {
  readonly students = signal<Student[]>([]);
  readonly loading = signal(true);
  readonly search = signal('');
  readonly total = signal(0);

  constructor(private readonly studentsService: StudentsService) {}

  ngOnInit(): void {
    this.load();
  }

  onSearchChange(value: string): void {
    this.search.set(value);
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.studentsService.list({ search: this.search() || undefined, limit: 50 }).subscribe({
      next: (res) => {
        this.students.set(res.data);
        this.total.set(res.meta.total);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
