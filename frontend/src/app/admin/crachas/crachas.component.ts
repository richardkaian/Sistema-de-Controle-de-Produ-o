// crachas.component.ts
import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService, Funcionario } from '../../services/admin.service';

@Component({
  selector: 'app-crachas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './crachas.component.html',
  styleUrl: './crachas.component.scss',
})
export class CrachasComponent implements OnInit {
  private adminService = inject(AdminService);

  funcionarios = signal<Funcionario[]>([]);
  carregando = signal(true);
  formularioAberto = signal(false);
  salvando = signal(false);
  erro = signal<string | null>(null);

  novoCodigoCracha = '';
  novoNome = '';
  novoCargo = '';
  novoRole: 'operador' | 'admin' = 'operador';
  novaSenha = '';

  ngOnInit(): void {
    this.carregar();
  }

  private carregar(): void {
    this.carregando.set(true);
    this.adminService.listarFuncionarios().subscribe({
      next: (lista) => {
        this.funcionarios.set(lista);
        this.carregando.set(false);
      },
      error: () => this.carregando.set(false),
    });
  }

  abrirFormulario(): void {
    this.formularioAberto.set(true);
    this.erro.set(null);
  }

  cancelarFormulario(): void {
    this.formularioAberto.set(false);
    this.novoCodigoCracha = '';
    this.novoNome = '';
    this.novoCargo = '';
    this.novoRole = 'operador';
    this.novaSenha = '';
    this.erro.set(null);
  }

  salvarNovoFuncionario(): void {
    if (!this.novoCodigoCracha || !this.novoNome) return;

    this.salvando.set(true);
    this.erro.set(null);

    this.adminService
      .criarFuncionario({
        codigo_cracha: this.novoCodigoCracha,
        nome: this.novoNome,
        cargo: this.novoCargo || undefined,
        role: this.novoRole,
        senha: this.novoRole === 'admin' ? this.novaSenha : undefined,
      })
      .subscribe({
        next: () => {
          this.salvando.set(false);
          this.cancelarFormulario();
          this.carregar();
        },
        error: (erro) => {
          this.salvando.set(false);
          this.erro.set(erro?.error?.erro ?? 'Falha ao cadastrar.');
        },
      });
  }

  alternarAtivo(funcionario: Funcionario): void {
    this.adminService.atualizarAtivo(funcionario.id, !funcionario.ativo).subscribe({
      next: () => this.carregar(),
    });
  }
}
