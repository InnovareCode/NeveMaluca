// Camada core/ (Vega: RNG, trig, hash, contratos, laço). API pública em docs/handoff-vega-m0.md. O armazenamento C4 ficou
// em src/meta/storage.ts (Cronos), não aqui. Importar este barril valida o núcleo no boot (exigirCoreValido); as camadas
// de cima também podem importar por arquivo (`../core/rng`), como no InnoFighters: os dois jeitos valem.
export * from './constantes';
export * from './erros';
export * from './contratos';
export * from './rng';
export * from './hash';
export * from './trig';
export * from './comandos';
export * from './replay';
export * from './laco';
export * from './validacao';

import { exigirCoreValido } from './validacao';

exigirCoreValido();
