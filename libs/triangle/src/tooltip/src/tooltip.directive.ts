import { Directive, ElementRef, HostBinding } from '@angular/core';

@Directive({
  selector: 'tri-tooltip, [triTooltip]'
})
export class TooltipDirective {
  @HostBinding('class.ant-tooltip-open') isTooltipOpen;

  constructor(public elementRef: ElementRef) {}
}
