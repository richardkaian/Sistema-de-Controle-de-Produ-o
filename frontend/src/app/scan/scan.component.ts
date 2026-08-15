// scan.component.ts
import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  signal,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BipagemService, Funcionario, ResultadoBipagem } from '../services/bipagem.service';
import {
  Etapa,
  ETAPA_LABEL,
  obterEtapaEstacao,
  definirEtapaEstacao,
  limparEtapaEstacao,
} from '../config';

type TipoMensagem = 'sucesso' | 'erro';

@Component({
  selector: 'app-scan',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './scan.component.html',
  styleUrl: './scan.component.scss',
})
export class ScanComponent implements AfterViewInit, OnDestroy {
  @ViewChild('leitor') leitorRef!: ElementRef<HTMLInputElement>;

  private bipagemService = inject(BipagemService);

  // null enquanto essa máquina ainda não teve a etapa configurada —
  // mostra a tela de setup nesse caso (ver template).
  etapaEstacao = signal<Etapa | null>(obterEtapaEstacao());
  readonly etapasDisponiveis: { valor: Etapa; rotulo: string }[] = (
    ['separacao', 'corte', 'usinagem', 'expedicao'] as Etapa[]
  ).map((valor) => ({ valor, rotulo: ETAPA_LABEL[valor] }));

  get etapaLabel(): string {
    const etapa = this.etapaEstacao();
    return etapa ? ETAPA_LABEL[etapa] : '';
  }

  escolherEtapa(etapa: Etapa): void {
    definirEtapaEstacao(etapa);
    this.etapaEstacao.set(etapa);
    this.focarLeitor();
  }

  trocarEstacao(): void {
    limparEtapaEstacao();
    this.etapaEstacao.set(null);
    this.operador.set(null);
    this.ultimoResultado.set(null);
  }

  operador = signal<Funcionario | null>(null);
  carregando = signal(false);
  mensagem = signal<{ tipo: TipoMensagem; texto: string } | null>(null);
  ultimoResultado = signal<ResultadoBipagem | null>(null);

  // Estado da conexão em tempo real com o servidor. Importante numa tela
  // de kiosk: se a rede cair, o operador precisa ver isso na hora, não
  // descobrir só quando uma bipagem falhar silenciosamente.
  conectado = signal(false);

  valorLeitura = '';
  private timeoutMensagem?: ReturnType<typeof setTimeout>;

  ngAfterViewInit(): void {
    this.focarLeitor();
    this.conectarSocket();
  }

  ngOnDestroy(): void {
    const socket = this.bipagemService.socket;
    socket.off('connect');
    socket.off('disconnect');
  }

  private conectarSocket(): void {
    const socket = this.bipagemService.socket;

    this.conectado.set(socket.connected);

    socket.on('connect', () => this.conectado.set(true));
    socket.on('disconnect', () => this.conectado.set(false));
  }

  focarLeitor(): void {
    // pequeno delay pra garantir que o elemento já existe no DOM
    // (ex: logo após um @if trocar de estado)
    setTimeout(() => this.leitorRef?.nativeElement.focus(), 0);
  }

  processarLeitura(): void {
    const valor = this.valorLeitura.trim();
    this.valorLeitura = '';
    if (!valor || !this.etapaEstacao()) return;

    if (this.ehLeituraDeOS(valor)) {
      this.biparOS(this.extrairNumeroOS(valor));
    } else {
      this.biparCracha(valor);
    }
  }

  // O código de barras da OS segue o padrão "OS-<numero>" (ex: OS-313614).
  // Qualquer outra leitura é tratada como número de crachá.
  private ehLeituraDeOS(valor: string): boolean {
    return /^OS-/i.test(valor);
  }

  private extrairNumeroOS(valor: string): string {
    return valor.replace(/^OS-/i, '');
  }

  private biparCracha(codigo: string): void {
    this.carregando.set(true);
    this.bipagemService.buscarFuncionario(codigo).subscribe({
      next: (funcionario) => {
        this.carregando.set(false);
        this.operador.set(funcionario);
        this.ultimoResultado.set(null);
        this.mostrarMensagem('sucesso', `Bem-vindo, ${funcionario.nome}`);
        this.focarLeitor();
      },
      error: (erro) => {
        this.carregando.set(false);
        this.mostrarMensagem('erro', erro?.error?.erro ?? 'Crachá não reconhecido.');
        this.focarLeitor();
      },
    });
  }

  private biparOS(numeroOs: string): void {
    const operadorAtual = this.operador();
    if (!operadorAtual) {
      this.mostrarMensagem('erro', 'Bipe seu crachá antes de bipar a OS.');
      this.focarLeitor();
      return;
    }

    const etapa = this.etapaEstacao();
    if (!etapa) {
      this.mostrarMensagem('erro', 'Estação sem etapa configurada.');
      return;
    }

    this.carregando.set(true);
    this.bipagemService
      .registrarBipagem(operadorAtual.codigo_cracha, numeroOs, etapa)
      .subscribe({
        next: (resultado) => {
          this.carregando.set(false);
          this.ultimoResultado.set(resultado);
          const acao = resultado.tipo_evento === 'inicio' ? 'Início' : 'Fim';
          this.mostrarMensagem(
            'sucesso',
            `${acao} registrado — OS ${resultado.os.numero_os} (${resultado.os.cliente})`
          );
          this.focarLeitor();
        },
        error: (erro) => {
          this.carregando.set(false);
          this.mostrarMensagem('erro', erro?.error?.erro ?? 'Falha ao registrar bipagem.');
          this.focarLeitor();
        },
      });
  }

  trocarOperador(): void {
    this.operador.set(null);
    this.ultimoResultado.set(null);
    this.mostrarMensagem('sucesso', 'Bipe o próximo crachá.');
    this.focarLeitor();
  }

  private mostrarMensagem(tipo: TipoMensagem, texto: string): void {
    this.mensagem.set({ tipo, texto });
    clearTimeout(this.timeoutMensagem);
    this.timeoutMensagem = setTimeout(() => this.mensagem.set(null), 4000);
  }
}
