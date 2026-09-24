import { mkdir, writeFile } from 'node:fs/promises';

async function analyzeFrame(evaluate, data) {
  return evaluate(`(() => new Promise((resolve) => {
    const image = new Image(); image.onload = () => {
      const canvas = new OffscreenCanvas(24, 15); const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0, 24, 15); const pixels = context.getImageData(0, 0, 24, 15).data;
      const values = []; for (let index = 0; index < pixels.length; index += 4) {
        values.push(.2126 * pixels[index] + .7152 * pixels[index + 1] + .0722 * pixels[index + 2]);
      } const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
      const deviation = Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length);
      resolve({ mean: Math.round(mean * 10) / 10, deviation: Math.round(deviation * 10) / 10,
        blank: (mean < 2.5 || mean > 252.5) && deviation < 1.5 });
    }; image.onerror = () => resolve({ mean: null, deviation: null, blank: false, decodeError: true });
    image.src = 'data:image/jpeg;base64,${data}';
  }))()`);
}

export function createScreencast(edge, outputDir) {
  const frames = []; let seen = 0; let active = false;
  edge.on('Page.screencastFrame', (event) => {
    void edge.send('Page.screencastFrameAck', { sessionId: event.sessionId });
    if (active && seen++ % 5 === 0) frames.push({ data: event.data,
      timestamp: event.metadata.timestamp ?? null });
  });
  return {
    async start() {
      frames.length = 0; seen = 0; active = true;
      await edge.send('Page.startScreencast', { format: 'jpeg', quality: 55, everyNthFrame: 1 });
    },
    async stop(label) {
      active = false;
      await edge.send('Page.stopScreencast').catch(() => undefined);
      const inspected = [];
      for (let index = 0; index < frames.length; index += 1) {
        const analysis = await analyzeFrame(edge.evaluate, frames[index].data);
        inspected.push({ index, timestamp: frames[index].timestamp, ...analysis });
        if (analysis.blank) {
          await mkdir(outputDir, { recursive: true });
          await writeFile(`${outputDir}/${label}-blank-${index}.jpg`, Buffer.from(frames[index].data, 'base64'));
        }
      }
      return { captured: seen, inspected, blanks: inspected.filter((frame) => frame.blank).length };
    },
    async screenshot(file) {
      const { data } = await edge.send('Page.captureScreenshot', { format: 'jpeg', quality: 72, fromSurface: true });
      await mkdir(outputDir, { recursive: true }); await writeFile(`${outputDir}/${file}`, Buffer.from(data, 'base64'));
    },
  };
}
