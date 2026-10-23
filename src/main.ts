/**
 * Montagem do M0: liga a plataforma (escala, orientação, foco, tela cheia, fontes, erros), valida o núcleo, lê o save, cria a cena vazia
 * de boot e roda o laço. Convenções mantidas do Vulcano: `html[data-pronto="true"]` quando o primeiro quadro foi desenhado (os e2e
 * esperam por ela) e `#err` para erro fatal de boot.
 *
 * Integração do M0 (Vega, 2026-10-22): `./core` valida o núcleo no import (`exigirCoreValido` + hash das tabelas de trig); `carregarSave`
 * lê o progresso uma vez no boot (nada é gravado além da cópia `-quebrada` que o próprio `carregarSave` faz); `AudioDestravavel` é criado
 * vazio e `desbloquearAudio` o liga aos gestos (o `AudioContext` só nasce no primeiro toque).
 *
 * Ordem dos imports IMPORTA: `erros-no-carregamento` vem antes de `./core` para que uma falha de validação no import apareça na caixa
 * `#err` (e não numa tela em branco).
 */
import './platform/erros-no-carregamento';
import './estilo.css';
import './platform/fontes.css';
import './platform/plataforma.css';
import './core';
import { AudioDestravavel } from './audio';
import { REGRAS_SAVE } from './data';
import { ArmazenamentoResiliente, carregarSave } from './meta';
import { criarAviso } from './platform/aviso';
import { desbloquearAudio } from './platform/audio-desbloqueio';
import { prepararCanvas, usarEspacoLogico } from './platform/canvas';
import { mostrarErro, textoDoErro } from './platform/erros';
import { observarEscala } from './platform/escala';
import { observarFoco } from './platform/foco';
import { carregarFontes } from './platform/fontes';
import { criarLaco } from './platform/laco';
import { observarOrientacao } from './platform/orientacao';
import { montarTelaCheia } from './platform/tela-cheia-ui';
import { criarGerenciadorCenas } from './ui/cenas/gerenciador';

/** Texto do aviso quando o save não pode ser gravado neste aparelho (modo privado, cota, build mais velho que o save). */
const AVISO_SEM_SAVE = 'Progresso não salvo neste aparelho';

async function boot(): Promise<void> {
  const { canvas, ctx } = prepararCanvas();
  observarEscala(canvas);
  const avisar = criarAviso(document.getElementById('aviso'));

  // um armazenamento resiliente para a sessão inteira; `dados` fica em memória (a UI do M1 usa e chama `salvarSave` ao fim da corrida)
  const armazenamento = new ArmazenamentoResiliente();
  const save = carregarSave(armazenamento, REGRAS_SAVE);
  // `avisar` cobre save de build mais novo e armazenamento ausente; `!persistente` cobre o modo privado, em que o resiliente cai para memória
  // sem falhar a leitura (estado "novo", avisar false) e o progresso morreria ao fechar a aba
  if (save.avisar || !armazenamento.persistente) avisar(AVISO_SEM_SAVE);

  // destrave do áudio no iPhone: o contexto só nasce (init) e liga (resume) dentro de um gesto que o WebKit reconhece
  const audio = new AudioDestravavel();
  desbloquearAudio(window, audio);

  // o canvas não espera a fonte: sem isto o título piscaria da fonte de reserva para a verdadeira (teto de 4 s, nunca prende a tela)
  await carregarFontes();

  const cena = criarGerenciadorCenas({
    canvas,
    janela: window,
    documento: document,
    save: save.dados,
    armazenamento,
    audio,
  });
  const desenharQuadro = (alpha: number): void => {
    usarEspacoLogico(ctx);
    cena.desenhar(ctx, alpha);
  };
  const laco = criarLaco({
    atualizar: () => cena.atualizar(),
    desenhar: desenharQuadro,
    aoErro: (e) => mostrarErro(textoDoErro(e)),
  });

  // pausas por motivo: o laço só anda sem nenhum motivo ativo
  observarFoco(window, {
    aoPerderFoco: () => laco.pausar('foco'),
    aoGanharFoco: () => laco.retomar('foco'),
    aoOcultar: () => laco.pausar('oculta'),
    aoMostrar: () => laco.retomar('oculta'),
  });
  if (document.hidden) laco.pausar('oculta');
  observarOrientacao(window, (retrato) => (retrato ? laco.pausar('retrato') : laco.retomar('retrato')));

  montarTelaCheia({ avisar });

  // primeiro quadro já agora (mesmo em retrato, com o laço pausado): o canvas nunca fica em branco por trás do aviso
  desenharQuadro(0);
  laco.iniciar();

  // ganchos de teste: só no servidor de desenvolvimento (não existem no build)
  if (import.meta.env.DEV) (window as unknown as { __neve: unknown }).__neve = { laco, cena, canvas, save, audio, armazenamento };

  document.documentElement.dataset['pronto'] = 'true';
}

boot().catch((e: unknown) => mostrarErro(textoDoErro(e)));
