import type { TidePoint } from '../shared/contracts'

const FULL_WIDTH = 520
export const TIDE_PLOT_LEFT = 12
export const TIDE_PLOT_RIGHT = 508

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value))
}

export function tideScaleModel(points: TidePoint[], width: number, top: number, bottom: number) {
  const times = points.map((point) => Date.parse(point.at))
  const start = Math.min(...times)
  const finalPoint = Math.max(...times)
  const end = Math.min(finalPoint, start + 24 * 3_600_000)
  const values = points.map((point) => point.heightFeet)
  const minimum = Math.min(...values)
  const maximum = Math.max(...values)
  const padding = Math.max(0.15, (maximum - minimum) * 0.1)
  const low = minimum - padding
  const high = maximum + padding
  const left = width === FULL_WIDTH ? TIDE_PLOT_LEFT : 1
  const right = width === FULL_WIDTH ? TIDE_PLOT_RIGHT : width - 1
  const x = (at: string) =>
    clamp(
      left + ((Date.parse(at) - start) / Math.max(1, end - start)) * (right - left),
      left,
      right,
    )
  const y = (height: number) =>
    clamp(bottom - ((height - low) / Math.max(0.001, high - low)) * (bottom - top), top, bottom)
  return { x, y }
}

export function tidePath(points: TidePoint[], width = 520, top = 91, bottom = 135) {
  const scale = tideScaleModel(points, width, top, bottom)
  return points
    .map(
      (point, index) =>
        `${index === 0 ? 'M' : 'L'}${scale.x(point.at).toFixed(2)} ${scale.y(point.heightFeet).toFixed(2)}`,
    )
    .join(' ')
}
