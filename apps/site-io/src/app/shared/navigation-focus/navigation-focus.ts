import { Directive, ElementRef, NgModule, OnInit } from '@angular/core';

/** The timeout id of the previous focus change. */
let lastTimeoutId = -1;

@Directive({
  selector: '[focusOnNavigation]',
  host    : {'tabindex': '-1'},
})
export class NavigationFocus implements OnInit {
  constructor(private el: ElementRef) {}

  ngOnInit() {
    window.clearTimeout(lastTimeoutId);
    // 100ms timeout is used to allow the page to settle before moving focus for screen readers.
    lastTimeoutId = window.setTimeout(() => this.el.nativeElement.focus(), 100);
  }
}

@NgModule({
  declarations: [NavigationFocus],
  exports     : [NavigationFocus],
})
export class NavigationFocusModule {}
