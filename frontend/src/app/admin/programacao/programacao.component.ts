// programacao.component.ts
import { Component, OnInit, OnDestroy, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { AdminService, OrdemServico } from '../../services/admin.service';
import { SocketService } from '../../services/socket.service';

@Component({
  selector: 'app-programacao',
  standalone: true,
  imports: [CommonModule, DragDropModule],
  templateUrl: './programacao.component.html',
  styleUrl: './programacao.component.scss',
})
export class ProgramacaoComponent implements OnInit, OnDestroy {
  private adminService = inject(AdminService);
  private socket = inject(SocketService);

  fila = signal<OrdemServico[]>([]);
  disponiveis = signal<OrdemServico[]>([]);
  carregando = signal(true);
  salvandoOrdem = signal(false);
  atualizandoOs = signal<string | null>(null); // numero_os em ação (adicionar/remover)

  // arrow function pra manter o "this" certo e permitir usar socket.off com a mesma referência
  private aoAtualizarProgramacao = () => this.carregar();

  ngOnInit(): void {
    this.carregar();
    // outro admin pode reordenar/adicionar em outra tela — mantém sincronizado
    this.socket.socket.on('programacao:atualizada', this.aoAtualizarProgramacao);
  }

  ngOnDestroy(): void {
    this.socket.socket.off('programacao:atualizada', this.aoAtualizarProgramacao);
  }

  private carregar(): void {
    this.adminService.buscarProgramacao().subscribe({
      next: ({ fila, disponiveis }) => {
        this.fila.set(fila);
        this.disponiveis.set(disponiveis);
        this.carregando.set(false);
      },
      error: () => this.carregando.set(false),
    });
  }

  arrastarNaFila(evento: CdkDragDrop<OrdemServico[]>): void {
    const listaAtual = [...this.fila()];
    moveItemInArray(listaAtual, evento.previousIndex, evento.currentIndex);
    this.fila.set(listaAtual); // aplica na tela na hora, sem esperar o servidor

    this.salvandoOrdem.set(true);
    this.adminService.reordenarProgramacao(listaAtual.map((os) => os.numero_os)).subscribe({
      next: () => this.salvandoOrdem.set(false),
      error: () => {
        this.salvandoOrdem.set(false);
        this.carregar(); // reordenar falhou no servidor — desfaz voltando pro estado real
      },
    });
  }

  adicionar(numeroOs: string): void {
    this.atualizandoOs.set(numeroOs);
    this.adminService.adicionarAProgramacao(numeroOs).subscribe({
      next: () => {
        this.atualizandoOs.set(null);
        this.carregar();
      },
      error: () => this.atualizandoOs.set(null),
    });
  }

  remover(numeroOs: string): void {
    this.atualizandoOs.set(numeroOs);
    this.adminService.removerDaProgramacao(numeroOs).subscribe({
      next: () => {
        this.atualizandoOs.set(null);
        this.carregar();
      },
      error: () => this.atualizandoOs.set(null),
    });
  }
}
