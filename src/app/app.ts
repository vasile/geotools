import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs';

@Component({
  selector: 'app-root',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  private readonly router = inject(Router);
  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
      startWith(this.router.url)
    ),
    { initialValue: this.router.url }
  );

  protected readonly title = 'GeoTools';
  protected readonly currentPage = computed(
    () => this.router.parseUrl(this.currentUrl()).root.children['primary']?.segments[0]?.path
  );
  protected readonly bboxQueryParams = computed(() => {
    const urlTree = this.router.parseUrl(this.currentUrl());
    const page = urlTree.root.children['primary']?.segments[0]?.path;

    return page === 'bbox' ? { ...urlTree.queryParams } : null;
  });
  protected readonly maskQueryParams = computed(() => {
    const urlTree = this.router.parseUrl(this.currentUrl());
    const page = urlTree.root.children['primary']?.segments[0]?.path;
    const bounds = urlTree.queryParams['bounds'];

    if (page === 'mask') {
      return { ...urlTree.queryParams };
    }

    return page === 'bbox' && typeof bounds === 'string' ? { bounds } : null;
  });
}
