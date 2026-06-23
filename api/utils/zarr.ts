import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

export interface ZarrArrayMetadata {
  zarr_format: number;
  shape: number[];
  chunks: number[];
  dtype: string;
  compressor: {
    id: string;
    level?: number;
  } | null;
  fill_value: number;
  order: 'C' | 'F';
  filters: any[] | null;
  dimension_separator: '/' | '.';
}

export interface ZarrGroupMetadata {
  zarr_format: number;
}

export interface ZarrAttributes {
  [key: string]: any;
}

export class ZarrArrayWriter {
  private rootPath: string;
  private metadata: ZarrArrayMetadata;
  private attrs: ZarrAttributes;

  constructor(
    rootPath: string,
    options: {
      shape: number[];
      chunks: number[];
      dtype?: string;
      compressor?: string | null;
      fillValue?: number;
      attrs?: ZarrAttributes;
    }
  ) {
    this.rootPath = rootPath;
    this.metadata = {
      zarr_format: 2,
      shape: options.shape,
      chunks: options.chunks,
      dtype: options.dtype || '<f4',
      compressor: options.compressor === null
        ? null
        : { id: options.compressor || 'gzip', level: 6 },
      fill_value: options.fillValue ?? 0,
      order: 'C',
      filters: null,
      dimension_separator: '/',
    };
    this.attrs = options.attrs || {};
  }

  async initialize(): Promise<void> {
    await fs.promises.mkdir(this.rootPath, { recursive: true });

    await fs.promises.writeFile(
      path.join(this.rootPath, '.zarray'),
      JSON.stringify(this.metadata, null, 2)
    );

    await fs.promises.writeFile(
      path.join(this.rootPath, '.zattrs'),
      JSON.stringify(this.attrs, null, 2)
    );
  }

  getChunkKey(chunkCoords: number[]): string {
    return chunkCoords.join(this.metadata.dimension_separator);
  }

  async writeChunk(chunkCoords: number[], data: Float32Array): Promise<void> {
    const chunkKey = this.getChunkKey(chunkCoords);
    const chunkPath = path.join(this.rootPath, chunkKey);

    await fs.promises.mkdir(path.dirname(chunkPath), { recursive: true });

    const buffer = Buffer.from(data.buffer);
    let dataToWrite: Buffer;

    if (this.metadata.compressor) {
      if (this.metadata.compressor.id === 'gzip') {
        dataToWrite = zlib.gzipSync(buffer, {
          level: this.metadata.compressor.level ?? 6,
        });
      } else {
        dataToWrite = buffer;
      }
    } else {
      dataToWrite = buffer;
    }

    await fs.promises.writeFile(chunkPath, dataToWrite);
  }

  async writeChunkRaw(chunkCoords: number[], data: Buffer): Promise<void> {
    const chunkKey = this.getChunkKey(chunkCoords);
    const chunkPath = path.join(this.rootPath, chunkKey);
    await fs.promises.mkdir(path.dirname(chunkPath), { recursive: true });
    await fs.promises.writeFile(chunkPath, data);
  }
}

export class ZarrArrayReader {
  private rootPath: string;
  private metadata: ZarrArrayMetadata | null = null;
  private attrs: ZarrAttributes | null = null;

  constructor(rootPath: string) {
    this.rootPath = rootPath;
  }

  async loadMetadata(): Promise<void> {
    const zarrayPath = path.join(this.rootPath, '.zarray');
    const zattrsPath = path.join(this.rootPath, '.zattrs');

    this.metadata = JSON.parse(
      await fs.promises.readFile(zarrayPath, 'utf-8')
    );

    if (fs.existsSync(zattrsPath)) {
      this.attrs = JSON.parse(await fs.promises.readFile(zattrsPath, 'utf-8'));
    } else {
      this.attrs = {};
    }
  }

  getMetadata(): ZarrArrayMetadata {
    if (!this.metadata) throw new Error('Metadata not loaded');
    return this.metadata;
  }

  getAttrs(): ZarrAttributes {
    if (!this.attrs) throw new Error('Attributes not loaded');
    return this.attrs;
  }

  async readChunk(chunkCoords: number[]): Promise<Float32Array | null> {
    if (!this.metadata) throw new Error('Metadata not loaded');

    const chunkKey = this.getChunkKey(chunkCoords);
    const chunkPath = path.join(this.rootPath, chunkKey);

    if (!fs.existsSync(chunkPath)) {
      return null;
    }

    const buffer = await fs.promises.readFile(chunkPath);
    let dataBuffer: Buffer;

    if (this.metadata.compressor) {
      if (this.metadata.compressor.id === 'gzip') {
        dataBuffer = zlib.gunzipSync(buffer);
      } else {
        dataBuffer = buffer;
      }
    } else {
      dataBuffer = buffer;
    }

    return new Float32Array(dataBuffer.buffer.slice(
      dataBuffer.byteOffset,
      dataBuffer.byteOffset + dataBuffer.byteLength
    ));
  }

  async readChunkRange(chunkCoords: number[], offset: number, length: number): Promise<Float32Array | null> {
    if (!this.metadata) throw new Error('Metadata not loaded');

    const chunkKey = this.getChunkKey(chunkCoords);
    const chunkPath = path.join(this.rootPath, chunkKey);

    if (!fs.existsSync(chunkPath)) {
      return null;
    }

    const stat = await fs.promises.stat(chunkPath);
    const file = await fs.promises.open(chunkPath, 'r');
    
    try {
      const isCompressed = this.metadata.compressor !== null;
      
      if (isCompressed) {
        const compressed = Buffer.alloc(stat.size);
        await file.read(compressed, 0, stat.size, 0);
        
        let decompressed: Buffer;
        if (this.metadata.compressor!.id === 'gzip') {
          decompressed = zlib.gunzipSync(compressed);
        } else {
          decompressed = compressed;
        }
        
        const start = offset * 4;
        const end = Math.min(start + length * 4, decompressed.length);
        const slice = decompressed.slice(start, end);
        
        return new Float32Array(slice.buffer.slice(
          slice.byteOffset,
          slice.byteOffset + slice.byteLength
        ));
      } else {
        const start = offset * 4;
        const byteLength = Math.min(length * 4, stat.size - start);
        const buffer = Buffer.alloc(byteLength);
        await file.read(buffer, 0, byteLength, start);
        
        return new Float32Array(buffer.buffer.slice(
          buffer.byteOffset,
          buffer.byteOffset + buffer.byteLength
        ));
      }
    } finally {
      await file.close();
    }
  }

  private getChunkKey(chunkCoords: number[]): string {
    if (!this.metadata) throw new Error('Metadata not loaded');
    return chunkCoords.join(this.metadata.dimension_separator);
  }

  getChunkCount(): number[] {
    if (!this.metadata) throw new Error('Metadata not loaded');
    return this.metadata.shape.map((dim, i) =>
      Math.ceil(dim / this.metadata!.chunks[i])
    );
  }
}

export function createZarrGroup(rootPath: string, attrs?: ZarrAttributes): void {
  fs.mkdirSync(rootPath, { recursive: true });

  const groupMeta: ZarrGroupMetadata = { zarr_format: 2 };
  fs.writeFileSync(
    path.join(rootPath, '.zgroup'),
    JSON.stringify(groupMeta, null, 2)
  );

  if (attrs) {
    fs.writeFileSync(
      path.join(rootPath, '.zattrs'),
      JSON.stringify(attrs, null, 2)
    );
  }
}
