/// <reference lib="webworker" />
import initGS from '@jspawn/ghostscript-wasm';

export interface ConvertRequestMessage {
  id: string;
  fileBytes: Uint8Array;
  fileName: string;
  fileType: 'eps' | 'ai';
  dpi: number;
}

export interface ConvertResponseMessage {
  id: string;
  success: boolean;
  jpegBytes?: Uint8Array;
  error?: string;
}

let gsModulePromise: Promise<any> | null = null;

function getGsModule(): Promise<any> {
  if (!gsModulePromise) {
    gsModulePromise = initGS({
      locateFile: (path: string) => {
        if (path.endsWith('.wasm')) return '/gs/gs.wasm';
        return path;
      },
      instantiateWasm: (
        imports: WebAssembly.Imports,
        successCallback: (instance: WebAssembly.Instance, module: WebAssembly.Module) => void
      ) => {
        fetch('/gs/gs.wasm')
          .then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status} fetching /gs/gs.wasm`);
            return res.arrayBuffer();
          })
          .then((buf) => WebAssembly.instantiate(buf, imports))
          .then((output) => successCallback(output.instance, output.module))
          .catch((err) => {
            console.error('Failed to instantiate Ghostscript WASM:', err);
          });
        return {};
      },
    });
  }
  return gsModulePromise;
}

self.onmessage = async (e: MessageEvent<ConvertRequestMessage>) => {
  const { id, fileBytes, fileType, dpi } = e.data;

  try {
    const mod = await getGsModule();
    const inputName = fileType === 'ai' ? 'input.ai' : 'input.eps';
    const outputName = 'out.jpg';

    // Cleanup any leftover files from previous run
    try { mod.FS.unlink(inputName); } catch {}
    try { mod.FS.unlink(outputName); } catch {}

    // Write file into virtual file system
    mod.FS.writeFile(inputName, fileBytes);

    // Build callMain arguments:
    // For EPS: -dBATCH -dNOPAUSE -dSAFER -dQUIET -dEPSCrop -sDEVICE=jpeg -dJPEGQ=90 -dTextAlphaBits=4 -dGraphicsAlphaBits=4 -r{dpi} -sOutputFile=out.jpg input.eps
    // For AI: use input.ai, drop -dEPSCrop and use -dUseCropBox
    const args: string[] = [
      '-dBATCH',
      '-dNOPAUSE',
      '-dSAFER',
      '-dQUIET',
      ...(fileType === 'ai' ? ['-dUseCropBox'] : ['-dEPSCrop']),
      '-sDEVICE=jpeg',
      '-dJPEGQ=90',
      '-dTextAlphaBits=4',
      '-dGraphicsAlphaBits=4',
      `-r${Math.round(dpi)}`,
      `-sOutputFile=${outputName}`,
      inputName,
    ];

    const exitCode = mod.callMain(args);

    let jpegBytes: Uint8Array | null = null;
    let readError: string | null = null;

    try {
      if (exitCode === 0) {
        jpegBytes = mod.FS.readFile(outputName);
      } else {
        readError = `Ghostscript exited with code ${exitCode}`;
      }
    } catch (err: unknown) {
      readError = err instanceof Error ? err.message : 'Failed to read converted image';
    } finally {
      try { mod.FS.unlink(inputName); } catch {}
      try { mod.FS.unlink(outputName); } catch {}
    }

    if (jpegBytes && jpegBytes.length > 0) {
      // Transfer the buffer for maximum performance
      (self as any).postMessage(
        {
          id,
          success: true,
          jpegBytes,
        },
        [jpegBytes.buffer]
      );
    } else {
      (self as any).postMessage({
        id,
        success: false,
        error: readError || 'Could not convert this file',
      });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Could not convert this file';
    (self as any).postMessage({
      id,
      success: false,
      error: msg,
    });
  }
};
