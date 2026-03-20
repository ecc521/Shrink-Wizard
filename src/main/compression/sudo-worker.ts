import * as net from 'net';
import * as os from 'os';
import * as path from 'path';
import fs from 'fs';
import { transparentlyCompress, undoTransparentCompression } from './macos';

const socketPath = process.argv[2];
if (!socketPath) {
  console.error('No socket path provided to sudo-worker');
  process.exit(1);
}

// Ensure the socket exists (the main process will have created it)
let client: net.Socket;

function connect() {
  client = net.createConnection(socketPath, () => {
    client.write(JSON.stringify({ type: 'ready' }) + '\n');
  });

  let buffer = '';
  client.on('data', async (data) => {
    buffer += data.toString();
    let newlineIdx;
    while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
      const msgStr = buffer.slice(0, newlineIdx);
      buffer = buffer.slice(newlineIdx + 1);
      
      if (!msgStr.trim()) continue;
      
      try {
        const msg = JSON.parse(msgStr);
        if (msg.type === 'process') {
          await handleProcess(msg.id, msg.file, msg.mode, msg.options);
        } else if (msg.type === 'exit') {
          process.exit(0);
        }
      } catch (e) {
        console.error('Invalid message from main process:', e);
      }
    }
  });

  client.on('error', (err) => {
    console.error('Socket error in sudo-worker:', err);
    process.exit(1);
  });

  client.on('end', () => {
    process.exit(0);
  });
}

connect();

async function handleProcess(id: string, file: any, mode: 'compress' | 'restore', options: any) {
  try {
    let result;
    if (mode === 'compress') {
      const osOptions = { algorithm: options.algorithm };
      const osStats = await transparentlyCompress(file.path, osOptions);
      if (osStats.mark) {
        if (osStats.compressedSize < osStats.originalSize) {
          result = { success: true, action: 'compressed', originalSize: osStats.originalSize, compressedSize: osStats.compressedSize };
        } else {
          result = { success: true, action: 'skipped' };
        }
      } else {
        result = { success: true, action: 'alreadyCompressed' };
      }
    } else if (mode === 'restore') {
      const stats = await undoTransparentCompression(file.path);
      result = { success: true, action: 'restored', originalSize: stats.uncompressedSize, compressedSize: stats.originalSize };
    }

    // Send result back to main process
    try {
      client.write(JSON.stringify({ type: 'result', id, file: file.path, result }) + '\n');
    } catch (err) {
      // socket closed
    }
  } catch (err: any) {
    try {
      client.write(JSON.stringify({ type: 'error', id, file: file.path, error: err.message }) + '\n');
    } catch (e) {
      // socket closed
    }
  }
}
