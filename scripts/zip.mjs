/**
 * Escritor de ZIP, o minimo que o formato exige.
 *
 * Existe porque nenhuma ferramenta do sistema serve nos tres lugares onde este
 * projeto e empacotado: o `zip` nao vem no Windows, e o Compress-Archive do
 * PowerShell 5.1, que vem, grava os caminhos com barra invertida. A
 * especificacao do ZIP manda usar barra normal, e quem descompactasse o release
 * fora do Windows receberia arquivos chamados "bundle\static\js\..." em vez de
 * pastas — uma extensao quebrada, e so para quem baixou.
 *
 * Cobre o caso deste projeto: arquivos pequenos, lidos inteiros na memoria, sem
 * Zip64 (nada aqui chega perto de 4 GB) e sem entradas de diretorio, que os
 * descompactadores criam sozinhos a partir do caminho.
 */

import { deflateRawSync } from "node:zlib";

const LOCAL_HEADER = 0x04034b50;
const CENTRAL_HEADER = 0x02014b50;
const END_OF_CENTRAL = 0x06054b50;

const DEFLATED = 8;
const STORED = 0;

/** Versao minima para extrair: 2.0, que e quando o deflate entrou. */
const VERSION_NEEDED = 20;

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);

  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }

  return table;
})();

const crc32 = (buffer) => {
  let crc = 0xffffffff;

  for (let index = 0; index < buffer.length; index += 1) {
    crc = CRC_TABLE[(crc ^ buffer[index]) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
};

/** O ZIP guarda a data no formato do MS-DOS, com segundos de dois em dois. */
const dosTime = (date) =>
  ((date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1)) & 0xffff;

const dosDate = (date) =>
  (((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()) & 0xffff;

/**
 * @param {{ name: string, data: Buffer, mtime?: Date }[]} entries
 *   `name` e o caminho dentro do arquivo, sempre com barra normal.
 * @returns {Buffer}
 */
export const createZip = (entries) => {
  const chunks = [];
  const directory = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name.replaceAll("\\", "/"), "utf8");
    const modified = entry.mtime ?? new Date();
    const compressed = deflateRawSync(entry.data);

    // Arquivo ja comprimido (PNG, por exemplo) cresce ao passar pelo deflate.
    const useDeflate = compressed.length < entry.data.length;
    const payload = useDeflate ? compressed : entry.data;
    const method = useDeflate ? DEFLATED : STORED;
    const crc = crc32(entry.data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(LOCAL_HEADER, 0);
    local.writeUInt16LE(VERSION_NEEDED, 4);
    local.writeUInt16LE(0, 6); // sem flags: nada de senha nem descritor posterior
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(dosTime(modified), 10);
    local.writeUInt16LE(dosDate(modified), 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(payload.length, 18);
    local.writeUInt32LE(entry.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28); // sem campo extra

    chunks.push(local, name, payload);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(CENTRAL_HEADER, 0);
    central.writeUInt16LE(VERSION_NEEDED, 4); // criado por
    central.writeUInt16LE(VERSION_NEEDED, 6); // necessario para extrair
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt16LE(dosTime(modified), 12);
    central.writeUInt16LE(dosDate(modified), 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(payload.length, 20);
    central.writeUInt32LE(entry.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30); // extra
    central.writeUInt16LE(0, 32); // comentario
    central.writeUInt16LE(0, 34); // numero do disco
    central.writeUInt16LE(0, 36); // atributos internos
    central.writeUInt32LE(0, 38); // atributos externos
    central.writeUInt32LE(offset, 42);

    directory.push(central, name);
    offset += local.length + name.length + payload.length;
  }

  const directoryBuffer = Buffer.concat(directory);

  const end = Buffer.alloc(22);
  end.writeUInt32LE(END_OF_CENTRAL, 0);
  end.writeUInt16LE(0, 4); // disco atual
  end.writeUInt16LE(0, 6); // disco do inicio do diretorio
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directoryBuffer.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20); // sem comentario

  return Buffer.concat([...chunks, directoryBuffer, end]);
};
