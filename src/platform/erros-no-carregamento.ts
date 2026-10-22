/**
 * Liga a caixa de erro (`#err`) NO CARREGAMENTO do módulo, antes de qualquer outro módulo do jogo ser avaliado. Importe este arquivo
 * PRIMEIRO no `main.ts`.
 *
 * Por quê: `core/index.ts` valida o núcleo no import (`exigirCoreValido`) e `core/trig.ts` confere o hash das tabelas no import. Se um
 * deles lançar, o erro acontece ANTES de a função `boot()` rodar, e quem registrava os ouvintes lá deixava a tela em branco sem mensagem
 * (no celular não há console). Os ES modules avaliam os imports na ordem em que aparecem, então este vem antes do `./core`.
 */
import { mostrarErrosNaTela } from './erros';

mostrarErrosNaTela();
