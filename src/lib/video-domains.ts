export function muxDirectUploadTarget(value: string): URL | undefined {
  try {
    const url = new URL(value);
    const regionalMuxUpload = url.protocol === 'https:' && !url.port &&
      /^direct-uploads-[a-z0-9-]+\.mux\.com$/.test(url.hostname);
    if ((regionalMuxUpload || url.origin === 'https://storage.googleapis.com') &&
      !url.username && !url.password && !url.hash) return url;
  } catch {
    // The caller reports an invalid or unrecognized upload endpoint.
  }
}
