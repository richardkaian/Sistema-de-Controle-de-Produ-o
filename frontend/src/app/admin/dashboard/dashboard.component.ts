// dashboard.component.ts
import { Component, OnInit, OnDestroy, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminService, OrdemServico, EventoBipagem } from '../../services/admin.service';
import { BipagemService } from '../../services/bipagem.service';

const STATUSES = ['aguardando', 'separacao', 'corte', 'usinagem', 'expedicao', 'concluido'] as const;

const STATUS_LABEL: Record<(typeof STATUSES)[number], string> = {
  aguardando: 'Aguardando',
  separacao: 'Separação',
  corte: 'Corte',
  usinagem: 'Usinagem',
  expedicao: 'Expedição',
  concluido: 'Concluído',
};

const ETAPA_LABEL: Record<string, string> = {
  separacao: 'Separação',
  corte: 'Corte',
  usinagem: 'Usinagem',
  expedicao: 'Expedição',
};

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit, OnDestroy {
  private adminService = inject(AdminService);
  private bipagemService = inject(BipagemService);

  readonly statuses = STATUSES;
  readonly statusLabel = STATUS_LABEL;
  readonly etapaLabel = ETAPA_LABEL;

  ordensPorStatus = signal<Record<string, OrdemServico[]>>({});
  eventos = signal<EventoBipagem[]>([]);
  carregando = signal(true);

  ngOnInit(): void {
    this.carregarOS();
    this.carregarEventos();
    this.conectarSocket();
  }

  ngOnDestroy(): void {
    const socket = this.bipagemService.socket;
    socket.off('os:nova', this.aoReceberOSNova);
    socket.off('bipagem:novo', this.aoReceberBipagem);
  }

  private conectarSocket(): void {
    const socket = this.bipagemService.socket;
    socket.on('os:nova', this.aoReceberOSNova);
    socket.on('bipagem:novo', this.aoReceberBipagem);
  }

  // arrow functions pra manter o "this" certo e permitir usar socket.off com a mesma referência
  private aoReceberOSNova = (): void => {
    this.carregarOS();
  };

  private aoReceberBipagem = (evento: EventoBipagem): void => {
    this.carregarOS();
    this.eventos.update((atual) => [evento, ...atual].slice(0, 30));
  };

  private carregarOS(): void {
    this.adminService.listarOS().subscribe({
      next: (lista) => {
        this.carregando.set(false);
        this.ordensPorStatus.set(this.agruparPorStatus(lista));
      },
      error: () => this.carregando.set(false),
    });
  }

  private carregarEventos(): void {
    this.adminService.listarEventos(30).subscribe({
      next: (lista) => this.eventos.set(lista),
    });
  }

  private agruparPorStatus(lista: OrdemServico[]): Record<string, OrdemServico[]> {
    const grupos: Record<string, OrdemServico[]> = {};
    for (const status of STATUSES) grupos[status] = [];
    for (const os of lista) {
      if (!grupos[os.status]) grupos[os.status] = [];
      grupos[os.status].push(os);
    }
    return grupos;
  }
}
