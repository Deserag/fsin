import { AfterViewInit, Component, ElementRef, EventEmitter, HostListener, Input, OnDestroy, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './modal.component.html',
  styleUrl: './modal.component.scss',
})
export class ModalComponent implements AfterViewInit, OnDestroy {
  private static openCount = 0;
  constructor(private readonly host: ElementRef<HTMLElement>) {}
  @Input() title = '';
  @Input() width = '480px';
  @Output() closed = new EventEmitter<void>();

  ngAfterViewInit(): void {
    // Render at document level so scroll containers and animated page transforms cannot clip the dialog.
    document.body.appendChild(this.host.nativeElement);
    ModalComponent.openCount++;
    document.body.classList.add('modal-open');
    this.host.nativeElement.querySelector<HTMLElement>('.modal-close')?.focus();
  }

  ngOnDestroy(): void {
    ModalComponent.openCount = Math.max(0, ModalComponent.openCount - 1);
    if (!ModalComponent.openCount) document.body.classList.remove('modal-open');
  }

  onBackdropClick(): void {
    this.closed.emit();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    const openDialogs = document.querySelectorAll('app-modal');
    if (openDialogs[openDialogs.length - 1] === this.host.nativeElement) this.closed.emit();
  }
}
