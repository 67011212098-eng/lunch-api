import { Routes } from '@angular/router';
import { jobGuard, ownerGuard } from './core/auth';
import { LoginComponent } from './pages/login.component';
import { HomeComponent } from './pages/home.component';
import { CustomersComponent } from './pages/customers.component';
import { OrdersComponent } from './pages/orders.component';
import { GpsComponent } from './pages/gps.component';
import { RiderComponent } from './pages/rider.component';
import { RidersComponent } from './pages/riders.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: '', component: HomeComponent, canActivate: [ownerGuard] },
  { path: 'customer', component: CustomersComponent, canActivate: [ownerGuard] },
  { path: 'order', component: OrdersComponent, canActivate: [ownerGuard] },
  { path: 'route/optimize', component: GpsComponent, canActivate: [ownerGuard] },
  { path: 'route/plan', redirectTo: 'route/optimize' },
  { path: 'rider', component: RidersComponent, canActivate: [ownerGuard] },
  { path: 'job/:code', component: RiderComponent, canActivate: [jobGuard] },
  { path: '**', redirectTo: '' },
];
