// Gera o ICONE PROVISORIO (bola de neve com olhos sobre ceu azul e morro branco) em public/icones/*.png.
// Sem dependencias: escreve PNG RGBA na mao (zlib + CRC32 do Node). Uso: `npm run icone:provisorio`.
// Provisorio por decisao D9 (logotipo): o Apolo desenha o definitivo no M4. A arte cabe na zona segura de
// 'maskable' (conteudo dentro do circulo central de 40% do lado), por isso o mesmo arquivo serve a 'any' e 'maskable'.
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const destino = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'public', 'icones');

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const CEU_TOPO = hex('#2a7de1');
const CEU_BASE = hex('#bfe4ff');
const NEVE = hex('#f4f9ff');
const SOMBRA = hex('#cfe3f7');
const OLHO = hex('#0b1a33');

/** Cor do ponto (x, y) em [0,1]x[0,1]. */
function cor(x, y) {
  let c = mix(CEU_TOPO, CEU_BASE, y);
  if (y > 0.76 - 0.14 * x) c = NEVE; // morro
  const dx = x - 0.5;
  const dy = y - 0.5;
  const d = Math.hypot(dx, dy);
  if (d < 0.27) c = d > 0.235 ? SOMBRA : NEVE; // bola de neve com borda
  for (const ox of [0.43, 0.57]) if (Math.hypot(x - ox, y - 0.47) < 0.035) c = OLHO;
  if (Math.abs(x - 0.5) < 0.05 && y > 0.53 && y < 0.58 && Math.hypot(x - 0.5, y - 0.53) < 0.06) c = OLHO; // boquinha
  return c;
}

function pixels(tam) {
  const buf = Buffer.alloc(tam * tam * 4);
  const N = 3; // supersampling NxN
  for (let py = 0; py < tam; py++) {
    for (let px = 0; px < tam; px++) {
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < N; sy++) {
        for (let sx = 0; sx < N; sx++) {
          const c = cor((px + (sx + 0.5) / N) / tam, (py + (sy + 0.5) / N) / tam);
          r += c[0]; g += c[1]; b += c[2];
        }
      }
      const i = (py * tam + px) * 4;
      buf[i] = Math.round(r / (N * N));
      buf[i + 1] = Math.round(g / (N * N));
      buf[i + 2] = Math.round(b / (N * N));
      buf[i + 3] = 255;
    }
  }
  return buf;
}

const TABELA_CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = TABELA_CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(tipo, dados) {
  const t = Buffer.from(tipo, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(dados.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, dados])));
  return Buffer.concat([len, t, dados, crc]);
}
function png(tam) {
  const rgba = pixels(tam);
  const linhas = Buffer.alloc((tam * 4 + 1) * tam);
  for (let y = 0; y < tam; y++) {
    linhas[y * (tam * 4 + 1)] = 0; // filtro 0
    rgba.copy(linhas, y * (tam * 4 + 1) + 1, y * tam * 4, (y + 1) * tam * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(tam, 0);
  ihdr.writeUInt32BE(tam, 4);
  ihdr[8] = 8; // profundidade
  ihdr[9] = 6; // RGBA
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(linhas, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

mkdirSync(destino, { recursive: true });
for (const [nome, tam] of [['icone-192.png', 192], ['icone-512.png', 512], ['apple-touch-icon-180.png', 180], ['favicon-32.png', 32]]) {
  writeFileSync(join(destino, nome), png(tam));
  console.log(`public/icones/${nome} (${tam}x${tam})`);
}
