import { Component, ViewChild } from '@angular/core';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { MatSidenavModule, MatSidenav } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { RouterModule, Router } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-root',
  standalone: true,
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  imports: [
    CommonModule,
    RouterModule,
    MatSidenavModule,
    MatToolbarModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    MatChipsModule,
  ],
})
export class AppComponent {
  @ViewChild(MatSidenav) sidenav!: MatSidenav;
  isDesktop = false;
  sidenavOpened = true;

  constructor(breakpoints: BreakpointObserver, private router: Router) {
    breakpoints.observe([Breakpoints.Handset]).subscribe((result) => {
      this.isDesktop = result.matches;
      this.sidenavOpened = !result.matches; // open by default on desktop
    });
  }

  navigateTo(route: string) {
    this.router.navigateByUrl(route);
  }

  toggleSidenav() {
    this.sidenav.toggle();
  }
}
