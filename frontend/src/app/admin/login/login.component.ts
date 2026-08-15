// login.component.ts
import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private auth = inject(AuthService);
  private router = inject(Router);

  codigoCracha = '';
  senha = '';
  carregando = signal(false);
  erro = signal<string | null>(null);

  async entrar(): Promise<void> {
    if (!this.codigoCracha || !this.senha) return;

    this.carregando.set(true);
    this.erro.set(null);

    try {
      await this.auth.login(this.codigoCracha, this.senha);
      this.router.navigate(['/admin/dashboard']);
    } catch (erro: any) {
      this.erro.set(erro?.error?.erro ?? 'Falha ao entrar.');
    } finally {
      this.carregando.set(false);
    }
  }
}
