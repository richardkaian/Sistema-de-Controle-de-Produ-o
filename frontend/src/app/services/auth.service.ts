// auth.service.ts
import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { CONFIG } from '../config';

export interface AdminLogado {
  id: number;
  codigo_cracha: string;
  nome: string;
  cargo: string | null;
  role: 'admin';
  ativo: 0 | 1;
}

const CHAVE_STORAGE = 'obr_admin_sessao';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);

  private _admin = signal<AdminLogado | null>(this.recuperarDoStorage());
  readonly admin = this._admin.asReadonly();
  readonly estaLogado = computed(() => this._admin() !== null);

  private recuperarDoStorage(): AdminLogado | null {
    try {
      const bruto = localStorage.getItem(CHAVE_STORAGE);
      return bruto ? JSON.parse(bruto) : null;
    } catch {
      return null;
    }
  }

  async login(codigoCracha: string, senha: string): Promise<AdminLogado> {
    const admin = await firstValueFrom(
      this.http.post<AdminLogado>(`${CONFIG.apiUrl}/auth/login`, {
        codigo_cracha: codigoCracha,
        senha,
      })
    );
    this._admin.set(admin);
    localStorage.setItem(CHAVE_STORAGE, JSON.stringify(admin));
    return admin;
  }

  logout(): void {
    this._admin.set(null);
    localStorage.removeItem(CHAVE_STORAGE);
  }

  async trocarSenha(senhaAtual: string, senhaNova: string): Promise<void> {
    const admin = this._admin();
    if (!admin) throw new Error('Sem admin logado.');

    await firstValueFrom(
      this.http.post(`${CONFIG.apiUrl}/auth/trocar-senha`, {
        codigo_cracha: admin.codigo_cracha,
        senha_atual: senhaAtual,
        senha_nova: senhaNova,
      })
    );
  }
}
