// os-list.component.ts
import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminService, OrdemServico, OrdemServicoDetalhe } from '../../services/admin.service';

const STATUSES_VALIDOS = ['aguardando', 'separacao', 'corte', 'usinagem', 'expedicao', 'concluido'] as const;

@Component({
  selector: 'app-os-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './os-list.component.html',
  styleUrl: './os-list.component.scss',
})
export class OsListComponent implements OnInit {
  private adminService = inject(AdminService);

  readonly statusesValidos = STATUSES_VALIDOS;

  ordens = signal<OrdemServico[]>([]);
  carregando = signal(true);
  osExpandida = signal<OrdemServicoDetalhe | null>(null);
  carregandoDetalhe = signal(false);
  atualizandoStatus = signal<string | null>(null); // numero_os em atualização, pra desabilitar o select

  ngOnInit(): void {
    this.adminService.listarOS().subscribe({
      next: (lista) => {
        this.ordens.set(lista);
        this.carregando.set(false);
      },
      error: () => this.carregando.set(false),
    });
  }

  alternarDetalhe(numeroOs: string): void {
    const atual = this.osExpandida();
    if (atual?.numero_os === numeroOs) {
      this.osExpandida.set(null);
      return;
    }

    this.carregandoDetalhe.set(true);
    this.adminService.buscarOS(numeroOs).subscribe({
      next: (detalhe) => {
        this.osExpandida.set(detalhe);
        this.carregandoDetalhe.set(false);
      },
      error: () => this.carregandoDetalhe.set(false),
    });
  }

  mudarStatus(numeroOs: string, novoStatus: string, evento: Event): void {
    evento.stopPropagation(); // não deixa o clique no <select> abrir/fechar o detalhe da linha

    this.atualizandoStatus.set(numeroOs);
    this.adminService.atualizarStatusOS(numeroOs, novoStatus).subscribe({
      next: (osAtualizada) => {
        this.ordens.update((lista) =>
          lista.map((os) => (os.numero_os === numeroOs ? { ...os, status: osAtualizada.status } : os))
        );
        this.atualizandoStatus.set(null);
      },
      error: () => this.atualizandoStatus.set(null),
    });
  }
}
