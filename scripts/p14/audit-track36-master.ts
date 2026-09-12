import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, extname, join } from 'node:path';

type Mp3Header = {
  version: 1 | 2 | 2.5; layer: number; bitrate: number;
  sampleRate: number; channels: number; frameBytes: number; samples: number;
};

const BITRATES = {
  1: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
  2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
} as const;

function mp3Header(data: Buffer, offset: number): Mp3Header | null {
  if (offset + 4 > data.length || data[offset] !== 0xff || (data[offset + 1] & 0xe0) !== 0xe0) return null;
  const versionBits = (data[offset + 1] >> 3) & 3;
  const layerBits = (data[offset + 1] >> 1) & 3;
  const bitrateIndex = (data[offset + 2] >> 4) & 15;
  const sampleIndex = (data[offset + 2] >> 2) & 3;
  if (versionBits === 1 || layerBits !== 1 || bitrateIndex < 1 || bitrateIndex > 14 || sampleIndex === 3) return null;
  const version = versionBits === 3 ? 1 : versionBits === 2 ? 2 : 2.5;
  const bitrate = BITRATES[version === 1 ? 1 : 2][bitrateIndex] * 1000;
  const sampleRate = [44100, 48000, 32000][sampleIndex] / (version === 1 ? 1 : version === 2 ? 2 : 4);
  const padding = (data[offset + 2] >> 1) & 1;
  const frameBytes = Math.floor((version === 1 ? 144 : 72) * bitrate / sampleRate) + padding;
  return {
    version, layer: 3, bitrate, sampleRate, channels: (data[offset + 3] >> 6) === 3 ? 1 : 2,
    frameBytes, samples: version === 1 ? 1152 : 576,
  };
}

function id3Size(data: Buffer): number {
  if (data.subarray(0, 3).toString('ascii') !== 'ID3') return 0;
  return 10 + [6, 7, 8, 9].reduce((sum, index) => (sum << 7) + (data[index] & 0x7f), 0);
}

function inspectMp3(data: Buffer) {
  let offset = id3Size(data);
  while (offset < data.length && !mp3Header(data, offset)) offset += 1;
  const firstOffset = offset;
  const first = mp3Header(data, offset);
  if (!first) throw new Error('未找到有效 MPEG Audio Layer III 帧');
  let frames = 0;
  let samples = 0;
  let minBitrate = Number.POSITIVE_INFINITY;
  let maxBitrate = 0;
  while (offset < data.length) {
    const header = mp3Header(data, offset);
    if (!header || header.version !== first.version || header.sampleRate !== first.sampleRate) break;
    frames += 1;
    samples += header.samples;
    minBitrate = Math.min(minBitrate, header.bitrate);
    maxBitrate = Math.max(maxBitrate, header.bitrate);
    offset += header.frameBytes;
  }
  return {
    codec: `MP3 (MPEG-${first.version} Layer III)`, sampleRate: first.sampleRate,
    channels: first.channels, durationSeconds: samples / first.sampleRate,
    frameCount: frames, bitrateMode: minBitrate === maxBitrate ? 'CBR' : 'VBR',
    bitrateRange: [minBitrate, maxBitrate], id3Bytes: firstOffset,
    parsedAudioBytes: offset - firstOffset, trailingBytes: data.length - offset,
  };
}

function inspectWav(data: Buffer) {
  if (data.subarray(0, 4).toString('ascii') !== 'RIFF'
    || data.subarray(8, 12).toString('ascii') !== 'WAVE') {
    throw new Error('同名 WAV 的 RIFF/WAVE 头无效');
  }
  let offset = 12;
  let format: { code: number; channels: number; sampleRate: number; bits: number; blockAlign: number } | null = null;
  let dataBytes = 0;
  while (offset + 8 <= data.length) {
    const id = data.subarray(offset, offset + 4).toString('ascii');
    const size = data.readUInt32LE(offset + 4);
    if (id === 'fmt ' && size >= 16) {
      format = {
        code: data.readUInt16LE(offset + 8), channels: data.readUInt16LE(offset + 10),
        sampleRate: data.readUInt32LE(offset + 12), blockAlign: data.readUInt16LE(offset + 20),
        bits: data.readUInt16LE(offset + 22),
      };
    }
    if (id === 'data') dataBytes = size;
    offset += 8 + size + (size % 2);
  }
  if (!format || dataBytes < 1) throw new Error('同名 WAV 缺少 fmt/data chunk');
  return {
    codec: format.code === 1 ? 'PCM' : `WAVE format ${format.code}`,
    sampleRate: format.sampleRate, channels: format.channels, bitsPerSample: format.bits,
    durationSeconds: dataBytes / (format.sampleRate * format.blockAlign), dataBytes,
  };
}

const input = process.argv[2];
if (!input) throw new Error('用法：npx tsx scripts/p14/audit-track36-master.ts <MSTR.mp3>');
const bytes = readFileSync(input);
const stem = basename(input, extname(input));
const wavPath = join(dirname(input), `${stem}.wav`);
const pkfPath = join(dirname(input), `${stem}.pkf`);
const wav = existsSync(wavPath) ? readFileSync(wavPath) : null;
const pkf = existsSync(pkfPath) ? readFileSync(pkfPath) : null;
console.log(JSON.stringify({
  fileName: basename(input), bytes: statSync(input).size,
  sha256: createHash('sha256').update(bytes).digest('hex'),
  ...inspectMp3(bytes),
  provenance: {
    sameBasenameWav: wav ? {
      fileName: basename(wavPath), bytes: statSync(wavPath).size,
      sha256: createHash('sha256').update(wav).digest('hex'), ...inspectWav(wav),
    } : null,
    sameBasenamePeakFile: pkf ? {
      fileName: basename(pkfPath), bytes: statSync(pkfPath).size,
      sha256: createHash('sha256').update(pkf).digest('hex'),
    } : null,
  },
}, null, 2));
