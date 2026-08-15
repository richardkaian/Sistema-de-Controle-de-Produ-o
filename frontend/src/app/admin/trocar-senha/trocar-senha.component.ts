// trocar-senha.component.ts
import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-trocar-senha',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './trocar-senha.component.html',
  styleUrl: './trocar-senha.component.scss',
})
export class TrocarSenhaComponent {
  private auth = inject(AuthService);

  senhaAtual = '';
  senhaNova = '';
  confirmarSenhaNova = '';

  carregando = signal(false);
  erro = signal<string | null>(null);
  sucesso = signal(false);

  async salvar(): Promise<void> {
    this.erro.set(null);
    this.sucesso.set(false);

    if (!this.senhaAtual || !this.senhaNova || !this.confirmarSenhaNova) {
      this.erro.set('Preencha todos os campos.');
      return;
    }
    if (this.senhaNova.length < 4) {
      this.erro.set('A senha nova precisa ter pelo menos 4 caracteres.');
      return;
    }
    if (this.senhaNova !== this.confirmarSenhaNova) {
      this.erro.set('A confirmação não bate com a senha nova.');
      return;
    }

    this.carregando.set(true);
    try {
      await this.auth.trocarSenha(this.senhaAtual, this.senhaNova);
      this.sucesso.set(true);
      this.senhaAtual = '';
      this.senhaNova = '';
      this.confirmarSenhaNova = '';
    } catch (erro: any) {
      this.erro.set(erro?.error?.erro ?? 'Falha ao trocar a senha.');
    } finally {
      this.carregando.set(false);
    }
  }
}
