import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GroupsService } from '../../core/services/groups.service';
import { Group } from '../../core/models/group.model';

@Component({
  selector: 'app-groups',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './groups.component.html',
  styleUrl: './groups.component.scss',
})
export class GroupsComponent implements OnInit {
  readonly groups = signal<Group[]>([]);
  readonly loading = signal(true);

  constructor(private readonly groupsService: GroupsService) {}

  ngOnInit(): void {
    this.groupsService.list().subscribe({
      next: (res) => {
        this.groups.set(res.data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
