// app.routes.ts
import { Routes } from '@angular/router';
import { ScanComponent } from './scan/scan.component';
import { LoginComponent } from './admin/login/login.component';
import { ShellComponent } from './admin/shell/shell.component';
import { DashboardComponent } from './admin/dashboard/dashboard.component';
import { OsListComponent } from './admin/os-list/os-list.component';
import { CrachasComponent } from './admin/crachas/crachas.component';
import { TrocarSenhaComponent } from './admin/trocar-senha/trocar-senha.component';
import { ProgramacaoComponent } from './admin/programacao/programacao.component';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', component: ScanComponent }, // tela de kiosk (bipagem), rota padrão
  { path: 'admin/login', component: LoginComponent },
  {
    path: 'admin',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: DashboardComponent },
      { path: 'programacao', component: ProgramacaoComponent },
      { path: 'os', component: OsListComponent },
      { path: 'crachas', component: CrachasComponent },
      { path: 'trocar-senha', component: TrocarSenhaComponent },
    ],
  },
  { path: '**', redirectTo: '' },
];
