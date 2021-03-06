import { POSITION_MAP } from '@gradii/triangle/core';
import { CompositeFilterDescriptor, FilterDescriptor } from '@gradii/triangle/data-query';
import { isNullOrEmptyString } from '@gradii/triangle/util';
import { CdkOverlayOrigin } from '@angular/cdk/overlay';
import { Component, HostBinding, Input } from '@angular/core';
import { ColumnComponent } from '../../columns/column.component';
import { extractFormat } from '../../utils';
import { BaseFilterCellComponent, filtersByField } from '../base-filter-cell.component';
import { FilterService } from '../filter.service';

@Component({
  selector           : 'tri-data-table-filter-menu',
  preserveWhitespaces: false,
  template           : `
    <a [ngClass]="{'ant-grid-filter':true, 'ant-state-active': hasFilters}"
       (click)="toggle($event)"
       href="#"
       title="Filter">
      <i class="anticon anticon-filter"></i>
    </a>
    <ng-template
      cdkConnectedOverlay
      cdkConnectedOverlayHasBackdrop
      [cdkConnectedOverlayOrigin]="origin"
      [cdkConnectedOverlayOpen]="_open"
      [cdkConnectedOverlayPositions]="_positions"
      (backdropClick)="closeMenu()"
      (detach)="closeMenu()">
      <tri-card>
        <tri-data-table-filter-menu-container
          [column]="column"
          [filter]="filter"
          (close)="close()"
        >
        </tri-data-table-filter-menu-container>
      </tri-card>
    </ng-template>
  `
})
export class FilterMenuComponent extends BaseFilterCellComponent {
  private popupRef;
  _open: boolean = false;
  _positions = [
    POSITION_MAP['bottomLeft'],
    POSITION_MAP['bottomRight'],
    POSITION_MAP['topLeft'],
    POSITION_MAP['topRight'],
  ];

  @Input('columnOverlayOrigin') origin: CdkOverlayOrigin;
  @Input() column: ColumnComponent;
  @Input() filter: CompositeFilterDescriptor;

  @HostBinding('class.ant-filtercell')
  get hostClasses(): boolean {
    return false;
  }

  get currentFilter(): FilterDescriptor {
    return this.filterByField(this.column.field);
  }

  get columnFormat() {
    return this.column && !isNullOrEmptyString(this.column.format) ? extractFormat(this.column.format) : 'd';
  }

  constructor(protected filterService: FilterService) {
    super(filterService);
  }

  get hasFilters(): boolean {
    return filtersByField(this.filter, this.column!.field).length > 0;
  }

  toggle(e: Event) {
    e.preventDefault();
    this._open = !this._open;
  }

  protected close(): void {
    // this.popupService.destroy();
    this._open = false;
  }

  closeMenu() {
    this._open = false;
  }
}
