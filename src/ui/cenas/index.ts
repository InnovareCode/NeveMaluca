// Cenas da UI (ui/cenas/). M1a (Lyra): descida, resultado e a composta "jogo" (descida -> resultado ->
// descida de novo) sobre o motor real da Vega. Fase 1 (Lyra, 2026-10-22): abertura/splash, menu principal
// com a Capi, tela de opções e o orquestrador (gerenciador) que liga Abertura -> Menu -> Jogo -> Resultado -> Menu.
// motor-teste/pista-teste são o "duble" do motor/gerador reais da Vega (ver README desta pasta).
export * from './abertura';
export * from './boot';
export * from './descida';
export * from './gerenciador';
export * from './jogo';
export * from './menu';
export * from './motor-teste';
export * from './opcoes';
export * from './pista-teste';
export * from './resultado';