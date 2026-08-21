export function decodificarBuffer(buffer: Buffer): string {
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return buffer.subarray(3).toString('utf-8');
  }
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return buffer.subarray(2).toString('utf16le');
  }
  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    const cuerpo = buffer.subarray(2);
    const par = cuerpo.length - (cuerpo.length % 2);
    return Buffer.from(cuerpo.subarray(0, par)).swap16().toString('utf16le');
  }
  return buffer.toString('utf-8');
}
