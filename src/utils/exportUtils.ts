import { Horizon, Fault } from '../../shared/types';

export function downloadTextFile(content: string, filename: string, mimeType: string = 'text/plain') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportHorizonsCSV(horizons: Horizon[]): string {
  const header = 'name,inline,crossline,time,x,y,z';
  const rows: string[] = [header];
  
  horizons.forEach((horizon) => {
    if (!horizon.visible || horizon.points.length === 0) return;
    horizon.points.forEach((pt) => {
      rows.push(
        `"${horizon.name}",${pt.x.toFixed(2)},${pt.y.toFixed(2)},${pt.z.toFixed(2)},${pt.x.toFixed(2)},${pt.y.toFixed(2)},${pt.z.toFixed(2)}`
      );
    });
  });
  
  return rows.join('\n');
}

export function exportFaultsCSV(faults: Fault[]): string {
  const header = 'name,inline,crossline,time,throw,x,y,z';
  const rows: string[] = [header];
  
  faults.forEach((fault) => {
    if (!fault.visible || fault.vertices.length === 0) return;
    fault.vertices.forEach((pt) => {
      rows.push(
        `"${fault.name}",${pt.x.toFixed(2)},${pt.y.toFixed(2)},${pt.z.toFixed(2)},${fault.throw.toFixed(2)},${pt.x.toFixed(2)},${pt.y.toFixed(2)},${pt.z.toFixed(2)}`
      );
    });
  });
  
  return rows.join('\n');
}

export function exportHorizonsJSON(horizons: Horizon[]): string {
  const visibleHorizons = horizons.filter(h => h.visible && h.points.length > 0);
  return JSON.stringify(
    visibleHorizons.map(h => ({
      name: h.name,
      color: h.color,
      points: h.points.map(pt => ({
        inline: pt.x,
        crossline: pt.y,
        time: pt.z,
        x: pt.x,
        y: pt.y,
        z: pt.z,
      })),
      pointCount: h.points.length,
    })),
    null,
    2
  );
}

export function exportFaultsJSON(faults: Fault[]): string {
  const visibleFaults = faults.filter(f => f.visible && f.vertices.length > 0);
  return JSON.stringify(
    visibleFaults.map(f => ({
      name: f.name,
      color: f.color,
      throw: f.throw,
      vertices: f.vertices.map(pt => ({
        inline: pt.x,
        crossline: pt.y,
        time: pt.z,
        x: pt.x,
        y: pt.y,
        z: pt.z,
      })),
      vertexCount: f.vertices.length,
    })),
    null,
    2
  );
}

export function exportCanvasAsPNG(canvas: HTMLCanvasElement, filename: string) {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 'image/png');
}
