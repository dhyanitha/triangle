import { GroupDescriptor } from '@gradii/triangle/data-query';
import { isPresent } from '@gradii/triangle/util';
import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  HostBinding,
  Inject,
  InjectionToken,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  OnInit,
  Optional,
  Output,
  QueryList,
  Renderer2,
  ViewChild
} from '@angular/core';
import { fromEvent } from 'rxjs/observable/fromEvent';
import 'rxjs/operator/filter';
import { filter } from 'rxjs/operators/filter';
import { map } from 'rxjs/operators/map';
import { merge } from 'rxjs/operators/merge';
import { switchMap } from 'rxjs/operators/switchMap';
import { tap } from 'rxjs/operators/tap';
import { Subject } from 'rxjs/Subject';
import { ColumnBase } from './columns/column-base';
import { ColumnsContainer } from './columns/columns-container';
import { NoRecordsTemplateDirective } from './directive/no-records-template.directive';
import { GroupableSettings } from './grouping/group-settings';
import { GroupsService } from './grouping/groups.service';
import { expandColumns } from './helper/column-common';
import { Action, PageAction, ScrollAction, ScrollerService } from './helper/scroller.service';
import { RowClassFn } from './row-class';
import { syncRowsHeight } from './row-sync';
import { ChangeNotificationService } from './service/change-notification.service';
import { DetailsService } from './service/details.service';
import { RowHeightService } from './service/row-height.service';
import { ScrollSyncService } from './service/scroll-sync.service';
import { SuspendService } from './service/suspend.service';
import { DetailTemplateDirective } from './table-shared/detail-template.directive';
import { isChanged, isUniversal } from './utils';

export const SCROLLER_FACTORY_TOKEN = new InjectionToken('grid-scroll-service-factory');

export function DEFAULT_SCROLLER_FACTORY(observable) {
  return new ScrollerService(observable);
}

const wheelDeltaY = e => {
  const deltaY = e.wheelDeltaY;
  if (e.wheelDelta && (deltaY === undefined || deltaY)) {
    return e.wheelDelta;
  } else if (e.detail && e.axis === e.VERTICAL_AXIS) {
    return -e.detail * 10;
  }
  return 0;
};
const preventLockedScroll = el => event => {
  if (el.scrollHeight > el.offsetHeight + el.scrollTop && el.scrollTop > 0) {
    event.preventDefault();
  }
};
const translateY = (renderer, value) => el => renderer.setStyle(el, 'transform', 'translateY(' + value + 'px)');
const firstChild = el => (el ? el.nativeElement.children[0] : null);

@Component({
  providers: [
    {
      provide : SCROLLER_FACTORY_TOKEN,
      useValue: DEFAULT_SCROLLER_FACTORY
    }
  ],
  selector : 'tri-grid-list',
  template : `
    <div
      #lockedContainer
      class="ant-grid-content-locked ant-table-tbody"
      *ngIf="isLocked"
      [style.width.px]="lockedWidth">
      <table>
        <colgroup
          triGridColGroup
          [groups]="groups"
          [columns]="lockedLeafColumns"
          [detailTemplate]="detailTemplate">
        </colgroup>
        <tbody
          triGridTableBody
          [groups]="groups"
          [data]="data"
          [noRecordsText]="''"
          [columns]="lockedLeafColumns"
          [detailTemplate]="detailTemplate"
          [showGroupFooters]="showFooter"
          [skip]="skip"
          [selectable]="selectable"
          [rowClass]="rowClass">
        </tbody>
      </table>
      <div
        class="ant-height-container">
        <div
          [style.height.px]="totalHeight"></div>
      </div>
    </div>
    <div
      #container
      class="ant-grid-content ant-virtual-content ant-table-tbody"
      [triGridResizableContainer]="lockedLeafColumns.length"
      [lockedWidth]="lockedWidth + 1">
      <table
        [style.width.px]="nonLockedWidth">
        <colgroup
          triGridColGroup
          [groups]="isLocked ? [] : groups"
          [columns]="nonLockedLeafColumns"
          [detailTemplate]="detailTemplate">
        </colgroup>
        <tbody
          triGridTableBody
          [skipGroupDecoration]="isLocked"
          [data]="data"
          [groups]="groups"
          [showGroupFooters]="showFooter"
          [columns]="nonLockedLeafColumns"
          [detailTemplate]="detailTemplate"
          [noRecordsTemplate]="noRecordsTemplate"
          [lockedColumnsCount]="lockedLeafColumns.length"
          [skip]="skip"
          [selectable]="selectable"
          [rowClass]="rowClass">
        </tbody>
      </table>
      <div
        class="ant-height-container">
        <div
          [style.height.px]="totalHeight"></div>
      </div>
    </div>
  `
})
export class ListComponent implements OnInit, OnChanges, AfterViewInit, OnDestroy {
  private changeNotification;
  private suspendService;
  private groupsService;
  private ngZone;
  private renderer;
  private scrollSyncService;
  // readonly hostClass: boolean;
  @Input() data: any[];
  @Input() groups: GroupDescriptor[];
  @Input() total: number;
  @Input() rowHeight: number;
  @Input() detailRowHeight: number;
  @Input() take: number;
  @Input() skip: number;
  @Input() columns: ColumnsContainer;
  @Input() detailTemplate: DetailTemplateDirective;
  @Input() noRecordsTemplate: NoRecordsTemplateDirective;
  @Input() selectable: boolean;
  @Input() groupable: GroupableSettings | boolean;
  @Input() rowClass: RowClassFn;
  @Output() pageChange: EventEmitter<Action>;
  totalHeight: number;
  // readonly showFooter: boolean;
  @ViewChild('container') container: ElementRef;
  @ViewChild('lockedContainer') lockedContainer: ElementRef;
  private scroller;
  private subscriptions;
  private dispatcher;
  private rowHeightService;

  constructor(@Inject(SCROLLER_FACTORY_TOKEN) scrollerFactory,
              detailsService: DetailsService,
              changeNotification: ChangeNotificationService,
              suspendService: SuspendService,
              @Optional() groupsService: GroupsService,
              ngZone: NgZone,
              renderer: Renderer2,
              scrollSyncService: ScrollSyncService) {
    this.changeNotification = changeNotification;
    this.suspendService = suspendService;
    this.groupsService = groupsService;
    this.ngZone = ngZone;
    this.renderer = renderer;
    this.scrollSyncService = scrollSyncService;
    this.groups = [];
    this.skip = 0;
    this.columns = new ColumnsContainer(() => []);
    this.groupable = false;
    this.pageChange = new EventEmitter();
    this.dispatcher = new Subject();
    this.scroller = scrollerFactory(this.dispatcher);
    this.subscriptions = detailsService.changes.subscribe(x => this.detailExpand(x));
  }

  @HostBinding('class.ant-grid-container')
  get hostClass() {
    return true;
  }

  get showFooter(): boolean {
    return this.groupable && (<GroupableSettings>this.groupable).showFooter;
  }

  get lockedLeafColumns(): QueryList<ColumnBase> {
    return this.columns.lockedLeafColumns;
  }

  get nonLockedLeafColumns(): QueryList<ColumnBase> {
    return this.columns.nonLockedLeafColumns;
  }

  get lockedWidth() {
    const groupCellsWidth = this.groups.length * 30;
    return expandColumns(this.lockedLeafColumns.toArray()).reduce(
      (prev, curr) => prev + (curr.width || 0),
      groupCellsWidth
    );
  }

  get nonLockedWidth() {
    const nonLockedLeafColumns = this.nonLockedLeafColumns;
    if (this.lockedLeafColumns.length) {
      return expandColumns(nonLockedLeafColumns.toArray()).reduce((prev, curr) => prev + (curr.width || 0), 0);
    }
    // if (this.rtl) {
    //   return expandColumns(nonLockedLeafColumns.toArray()).reduce((prev, curr) => prev + curr.width, 0) || '100%';
    // }
    return undefined;
  }

  get isLocked() {
    return this.lockedLeafColumns.length > 0;
  }

  ngOnInit() {
    this.init();
    this.handleRowSync();
  }

  ngOnChanges(changes) {
    if (isChanged('total', changes)) {
      this.init();
    }
  }

  ngAfterViewInit() {
    this.container.nativeElement.scrollTop = this.rowHeightService.offset(this.skip);
    this.attachContainerScroll();
  }

  syncRowsHeight() {
    if (this.lockedContainer) {
      syncRowsHeight(this.lockedContainer.nativeElement.children[0], this.container.nativeElement.children[0]);
    }
  }

  ngOnDestroy() {
    if (this.subscriptions) {
      this.subscriptions.unsubscribe();
    }
    if (this.scroller) {
      this.scroller.destroy();
    }
  }

  init() {
    if (this.suspendService.scroll) {
      return;
    }
    this.rowHeightService = new RowHeightService(this.total, this.rowHeight, this.detailRowHeight);
    this.totalHeight = this.rowHeightService.totalHeight();
    if (!isUniversal()) {
      this.ngZone.runOutsideAngular(this.createScroller.bind(this));
    }
  }

  detailExpand(_a) {
    const index = _a.index;
    const expand = _a.expand;
    if (expand) {
      this.rowHeightService.expandDetail(index);
    } else {
      this.rowHeightService.collapseDetail(index);
    }
    this.totalHeight = this.rowHeightService.totalHeight();
  }

  attachContainerScroll() {
    if (!isUniversal()) {
      this.ngZone.runOutsideAngular(() =>
        this.subscriptions.add(
          fromEvent(this.container.nativeElement, 'scroll')
            .pipe(
              map((event: any) => event.target),
              filter(() => !this.suspendService.scroll),
              tap(this.onContainerScroll.bind(this))
            )
            .subscribe(this.dispatcher)
        )
      );
      this.scrollSyncService.registerEmitter(this.container.nativeElement, 'body');
      if (this.lockedContainer) {
        this.subscriptions.add(
          fromEvent(this.lockedContainer.nativeElement, 'mousewheel')
            .pipe(
              merge(fromEvent(this.lockedContainer.nativeElement, 'DOMMouseScroll')),
              filter((event: any) => !event.ctrlKey),
              tap(preventLockedScroll(this.container.nativeElement)),
              map(wheelDeltaY)
            )
            .subscribe(x => (this.container.nativeElement.scrollTop -= x))
        );
        this.syncRowsHeight();
      }
    }
  }

  createScroller() {
    const observable = this.scroller.create(this.rowHeightService, this.skip, this.take, this.total);
    this.subscriptions.add(
      observable
        .pipe(filter(x => x instanceof PageAction))
        .subscribe(x => this.ngZone.run(() => this.pageChange.emit(x)))
        .add(observable.pipe(filter(x => x instanceof ScrollAction)).subscribe(this.scroll.bind(this)))
    );
  }

  scroll(_a) {
    const offset = _a.offset;
    [firstChild(this.container), firstChild(this.lockedContainer)]
      .filter(isPresent)
      .forEach(translateY(this.renderer, offset));
  }

  onContainerScroll({scrollTop}) {
    if (this.lockedContainer) {
      this.lockedContainer.nativeElement.scrollTop = scrollTop;
    }
  }

  handleRowSync() {
    this.ngZone.runOutsideAngular(() =>
      this.subscriptions.add(
        this.changeNotification.changes
          .pipe(
            merge(this.groupsService.changes.pipe(switchMap(() => this.ngZone.onStable.take(1)))),
            filter(() => isPresent(this.lockedContainer))
          )
          .subscribe(() => this.syncRowsHeight())
      )
    );
  }
}
