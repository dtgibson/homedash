import { createHash } from 'node:crypto'
import { inflateSync } from 'node:zlib'
import type { Bookmark } from '../src/shared/contracts.js'
import type { FetchLike } from './types.js'

export type FaviconMime = 'image/x-icon' | 'image/png' | 'image/jpeg'

export interface ValidatedFavicon {
  bytes: Uint8Array
  mimeType: FaviconMime
  width: number
  height: number
}

export type FaviconOutcome = { kind: 'success'; image: ValidatedFavicon } | { kind: 'unavailable' }

interface CacheEntry {
  bookmarkId: string
  outcome: FaviconOutcome
  expiresAtMs: number
}

interface InflightEntry {
  bookmarkId: string
  promise: Promise<FaviconOutcome>
  invalidation: { invalidated: boolean }
}

interface IcoDirectoryEntry {
  width: number
  height: number
  colorCount: number
  planes: number
  bitDepth: number
  bodyLength: number
  bodyOffset: number
}

interface QueuedPermit {
  signal: AbortSignal
  resolve: () => void
  reject: (error: Error) => void
  onAbort: () => void
}

const UNAVAILABLE: FaviconOutcome = { kind: 'unavailable' }
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308])

export const FAVICON_BODY_LIMIT_BYTES = 131_072
export const FAVICON_CACHE_MAX_ENTRIES = 128
export const FAVICON_DEADLINE_MS = 2_000
export const FAVICON_ICO_MAX_ENTRIES = 32
export const FAVICON_ICO_VALIDATION_WORK_LIMIT_BYTES = 16 * 1024 * 1024
export const FAVICON_POSITIVE_TTL_MS = 86_400_000
export const FAVICON_NEGATIVE_TTL_MS = 900_000

class PermitPool {
  private active = 0
  private readonly queue: QueuedPermit[] = []

  constructor(private readonly limit: number) {}

  async run<T>(signal: AbortSignal, work: () => Promise<T>): Promise<T> {
    await this.acquire(signal)
    try {
      return await work()
    } finally {
      this.release()
    }
  }

  private acquire(signal: AbortSignal): Promise<void> {
    if (signal.aborted) return Promise.reject(new Error('aborted'))
    if (this.active < this.limit) {
      this.active += 1
      return Promise.resolve()
    }

    return new Promise((resolve, reject) => {
      const permit: QueuedPermit = {
        signal,
        resolve,
        reject,
        onAbort: () => {
          const index = this.queue.indexOf(permit)
          if (index >= 0) this.queue.splice(index, 1)
          reject(new Error('aborted'))
        },
      }
      signal.addEventListener('abort', permit.onAbort, { once: true })
      this.queue.push(permit)
    })
  }

  private release() {
    while (this.queue.length) {
      const next = this.queue.shift()!
      next.signal.removeEventListener('abort', next.onAbort)
      if (next.signal.aborted) {
        next.reject(new Error('aborted'))
        continue
      }
      next.resolve()
      return
    }
    this.active -= 1
  }
}

function uint16Le(bytes: Uint8Array, offset: number) {
  return bytes[offset]! | (bytes[offset + 1]! << 8)
}

function uint32Le(bytes: Uint8Array, offset: number) {
  return (
    (bytes[offset]! |
      (bytes[offset + 1]! << 8) |
      (bytes[offset + 2]! << 16) |
      (bytes[offset + 3]! << 24)) >>>
    0
  )
}

function uint16Be(bytes: Uint8Array, offset: number) {
  return (bytes[offset]! << 8) | bytes[offset + 1]!
}

function uint32Be(bytes: Uint8Array, offset: number) {
  return (
    ((bytes[offset]! << 24) |
      (bytes[offset + 1]! << 16) |
      (bytes[offset + 2]! << 8) |
      bytes[offset + 3]!) >>>
    0
  )
}

function hasBytes(bytes: Uint8Array, offset: number, length: number) {
  return offset >= 0 && length >= 0 && offset <= bytes.length - length
}

function crc32(bytes: Uint8Array, start: number, end: number) {
  let crc = 0xffffffff
  for (let offset = start; offset < end; offset += 1) {
    crc ^= bytes[offset]!
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function isPngSignature(bytes: Uint8Array) {
  return (
    hasBytes(bytes, 0, PNG_SIGNATURE.length) &&
    PNG_SIGNATURE.every((value, index) => bytes[index] === value)
  )
}

function paddedBitmapRowBytes(width: number, bitDepth: number) {
  return Math.ceil((width * bitDepth) / 32) * 4
}

function icoBodyValidationWork(bytes: Uint8Array) {
  if (
    isPngSignature(bytes) &&
    hasBytes(bytes, 8, 25) &&
    uint32Be(bytes, 8) === 13 &&
    bytes[12] === 73 &&
    bytes[13] === 72 &&
    bytes[14] === 68 &&
    bytes[15] === 82
  ) {
    const width = uint32Be(bytes, 16)
    const height = uint32Be(bytes, 20)
    if (width >= 1 && width <= 512 && height >= 1 && height <= 512) {
      return Math.max(bytes.byteLength, width * height * 8 + height * 4)
    }
  }
  return bytes.byteLength
}

function validIcoBody(
  bytes: Uint8Array,
  width: number,
  height: number,
  directoryPlanes: number,
  directoryBitDepth: number,
  directoryColorCount: number,
) {
  if (isPngSignature(bytes)) {
    const png = parsePng(bytes)
    return png?.width === width && png.height === height
  }
  if (!hasBytes(bytes, 0, 40)) return false
  const headerLength = uint32Le(bytes, 0)
  if (![40, 52, 56, 108, 124].includes(headerLength) || !hasBytes(bytes, 0, headerLength)) {
    return false
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const dibWidth = view.getInt32(4, true)
  const doubledHeight = view.getInt32(8, true)
  const planes = uint16Le(bytes, 12)
  const bitDepth = uint16Le(bytes, 14)
  const compression = uint32Le(bytes, 16)
  const imageLength = uint32Le(bytes, 20)
  const colorsUsed = uint32Le(bytes, 32)
  if (
    dibWidth !== width ||
    doubledHeight !== height * 2 ||
    planes !== 1 ||
    directoryPlanes !== planes ||
    directoryBitDepth !== bitDepth ||
    ![1, 4, 8, 24, 32].includes(bitDepth) ||
    (compression !== 0 && !(compression === 3 && bitDepth === 32))
  ) {
    return false
  }

  const maximumPaletteColors = bitDepth <= 8 ? 2 ** bitDepth : 0
  if (
    colorsUsed > 256 ||
    (bitDepth <= 8 && colorsUsed > maximumPaletteColors) ||
    (directoryColorCount !== 0 && directoryColorCount !== (colorsUsed || maximumPaletteColors))
  ) {
    return false
  }
  const paletteColors = colorsUsed || maximumPaletteColors
  const externalBitMasks = compression === 3 && headerLength === 40 ? 12 : 0
  const pixelOffset = headerLength + externalBitMasks + paletteColors * 4
  const xorLength = paddedBitmapRowBytes(width, bitDepth) * height
  const andLength = paddedBitmapRowBytes(width, 1) * height
  if (imageLength !== 0 && (imageLength < xorLength || imageLength > bytes.length - pixelOffset)) {
    return false
  }
  return hasBytes(bytes, pixelOffset, xorLength + andLength)
}

function parseIco(bytes: Uint8Array): Omit<ValidatedFavicon, 'bytes'> | null {
  if (!hasBytes(bytes, 0, 6) || uint16Le(bytes, 0) !== 0 || uint16Le(bytes, 2) !== 1) {
    return null
  }
  const count = uint16Le(bytes, 4)
  const directoryLength = 6 + count * 16
  if (count < 1 || count > FAVICON_ICO_MAX_ENTRIES || !hasBytes(bytes, 0, directoryLength)) {
    return null
  }

  const entries: IcoDirectoryEntry[] = []
  for (let index = 0; index < count; index += 1) {
    const offset = 6 + index * 16
    const width = bytes[offset] === 0 ? 256 : bytes[offset]!
    const height = bytes[offset + 1] === 0 ? 256 : bytes[offset + 1]!
    const colorCount = bytes[offset + 2]!
    const reserved = bytes[offset + 3]
    const planes = uint16Le(bytes, offset + 4)
    const bitDepth = uint16Le(bytes, offset + 6)
    const bodyLength = uint32Le(bytes, offset + 8)
    const bodyOffset = uint32Le(bytes, offset + 12)
    if (
      reserved !== 0 ||
      width < 1 ||
      width > 512 ||
      height < 1 ||
      height > 512 ||
      bodyLength < 1 ||
      bodyOffset < directoryLength ||
      !hasBytes(bytes, bodyOffset, bodyLength)
    ) {
      return null
    }
    entries.push({ width, height, colorCount, planes, bitDepth, bodyLength, bodyOffset })
  }

  const ranges = [...entries].sort((left, right) => left.bodyOffset - right.bodyOffset)
  let embeddedBodyBytes = 0
  let validationWork = 0
  let previousEnd = directoryLength
  for (const entry of ranges) {
    if (entry.bodyOffset < previousEnd) return null
    previousEnd = entry.bodyOffset + entry.bodyLength
    embeddedBodyBytes += entry.bodyLength
    const body = bytes.subarray(entry.bodyOffset, previousEnd)
    validationWork += icoBodyValidationWork(body)
    if (
      embeddedBodyBytes > FAVICON_BODY_LIMIT_BYTES ||
      validationWork > FAVICON_ICO_VALIDATION_WORK_LIMIT_BYTES
    ) {
      return null
    }
  }

  let width = 0
  let height = 0
  for (const entry of entries) {
    const body = bytes.subarray(entry.bodyOffset, entry.bodyOffset + entry.bodyLength)
    if (
      !validIcoBody(body, entry.width, entry.height, entry.planes, entry.bitDepth, entry.colorCount)
    ) {
      return null
    }
    width = Math.max(width, entry.width)
    height = Math.max(height, entry.height)
  }
  return { mimeType: 'image/x-icon', width, height }
}

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10]

const PNG_CHANNELS: Record<number, number> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }
const ADAM7_PASSES = [
  [0, 0, 8, 8],
  [4, 0, 8, 8],
  [0, 4, 4, 8],
  [2, 0, 4, 4],
  [0, 2, 2, 4],
  [1, 0, 2, 2],
  [0, 1, 1, 2],
] as const

function passDimension(size: number, start: number, step: number) {
  return size <= start ? 0 : Math.ceil((size - start) / step)
}

function validPngImageData(
  chunks: Uint8Array[],
  compressedLength: number,
  width: number,
  height: number,
  bitDepth: number,
  colorType: number,
  interlace: number,
) {
  if (compressedLength < 1) return false
  const bitsPerPixel = PNG_CHANNELS[colorType]! * bitDepth
  const passes = interlace === 0 ? ([[0, 0, 1, 1]] as const) : ADAM7_PASSES
  let expectedLength = 0
  const layouts: Array<{ rows: number; rowBytes: number }> = []
  for (const [startX, startY, stepX, stepY] of passes) {
    const passWidth = passDimension(width, startX, stepX)
    const passHeight = passDimension(height, startY, stepY)
    if (passWidth === 0 || passHeight === 0) continue
    const rowBytes = Math.ceil((passWidth * bitsPerPixel) / 8)
    expectedLength += passHeight * (rowBytes + 1)
    layouts.push({ rows: passHeight, rowBytes })
  }

  let inflated: Uint8Array
  try {
    const compressed = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)))
    const result = inflateSync(compressed, {
      info: true,
      maxOutputLength: expectedLength + 1,
    }) as unknown as { buffer: Uint8Array; engine: { bytesWritten: number } }
    if (result.engine.bytesWritten !== compressed.byteLength) return false
    inflated = result.buffer
  } catch {
    return false
  }
  if (inflated.byteLength !== expectedLength) return false

  let offset = 0
  for (const layout of layouts) {
    for (let row = 0; row < layout.rows; row += 1) {
      if (inflated[offset]! > 4) return false
      offset += layout.rowBytes + 1
    }
  }
  return offset === inflated.byteLength
}

function parsePng(bytes: Uint8Array): Omit<ValidatedFavicon, 'bytes'> | null {
  if (!isPngSignature(bytes)) return null

  let offset = 8
  let width = 0
  let height = 0
  let bitDepth = 0
  let colorType = 0
  let interlace = 0
  let sawHeader = false
  let sawData = false
  let dataEnded = false
  let sawPalette = false
  let compressedLength = 0
  const dataChunks: Uint8Array[] = []
  while (hasBytes(bytes, offset, 12)) {
    const length = uint32Be(bytes, offset)
    const typeOffset = offset + 4
    const bodyOffset = typeOffset + 4
    const nextOffset = bodyOffset + length + 4
    if (nextOffset < bodyOffset || nextOffset > bytes.length) return null
    if (crc32(bytes, typeOffset, bodyOffset + length) !== uint32Be(bytes, bodyOffset + length)) {
      return null
    }
    const type = String.fromCharCode(
      bytes[typeOffset]!,
      bytes[typeOffset + 1]!,
      bytes[typeOffset + 2]!,
      bytes[typeOffset + 3]!,
    )
    const typeBytes = bytes.subarray(typeOffset, typeOffset + 4)
    if (
      [...typeBytes].some(
        (value) => !((value >= 65 && value <= 90) || (value >= 97 && value <= 122)),
      ) ||
      (typeBytes[2]! & 0x20) !== 0
    ) {
      return null
    }

    if (!sawHeader) {
      if (type !== 'IHDR' || length !== 13) return null
      width = uint32Be(bytes, bodyOffset)
      height = uint32Be(bytes, bodyOffset + 4)
      bitDepth = bytes[bodyOffset + 8]!
      colorType = bytes[bodyOffset + 9]!
      const validBitDepths: Record<number, number[]> = {
        0: [1, 2, 4, 8, 16],
        2: [8, 16],
        3: [1, 2, 4, 8],
        4: [8, 16],
        6: [8, 16],
      }
      if (
        width < 1 ||
        width > 512 ||
        height < 1 ||
        height > 512 ||
        !validBitDepths[colorType]?.includes(bitDepth) ||
        bytes[bodyOffset + 10] !== 0 ||
        bytes[bodyOffset + 11] !== 0 ||
        (bytes[bodyOffset + 12] !== 0 && bytes[bodyOffset + 12] !== 1)
      ) {
        return null
      }
      interlace = bytes[bodyOffset + 12]!
      sawHeader = true
    } else if (type === 'IHDR' || type === 'acTL') {
      return null
    } else if (type === 'PLTE') {
      if (
        sawPalette ||
        sawData ||
        colorType === 0 ||
        colorType === 4 ||
        length < 3 ||
        length > 768 ||
        length % 3 !== 0 ||
        (colorType === 3 && length / 3 > 2 ** bitDepth)
      ) {
        return null
      }
      sawPalette = true
    } else if (type === 'IDAT') {
      if (dataEnded || (colorType === 3 && !sawPalette)) return null
      sawData = true
      compressedLength += length
      dataChunks.push(bytes.subarray(bodyOffset, bodyOffset + length))
    } else if (type === 'IEND') {
      if (
        length !== 0 ||
        !sawData ||
        nextOffset !== bytes.length ||
        !validPngImageData(
          dataChunks,
          compressedLength,
          width,
          height,
          bitDepth,
          colorType,
          interlace,
        )
      ) {
        return null
      }
      return { mimeType: 'image/png', width, height }
    } else {
      if ((typeBytes[0]! & 0x20) === 0) return null
      if (sawData) dataEnded = true
    }
    offset = nextOffset
  }
  return null
}

const SUPPORTED_JPEG_SOF = new Set([0xc0, 0xc1, 0xc2])
const UNSUPPORTED_JPEG_SOF = new Set([0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf])

interface JpegFrame {
  marker: number
  components: Map<number, number>
}

function parseJpeg(bytes: Uint8Array): Omit<ValidatedFavicon, 'bytes'> | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null
  let offset = 2
  let width = 0
  let height = 0
  let frame: JpegFrame | null = null
  let sawScan = false
  const scannedComponents = new Set<number>()
  const quantizationTables = new Set<number>()
  const dcTables = new Set<number>()
  const acTables = new Map<number, Set<number>>()

  while (offset < bytes.length) {
    if (bytes[offset] !== 0xff) return null
    while (bytes[offset] === 0xff) offset += 1
    if (offset >= bytes.length) return null
    const marker = bytes[offset++]!
    if (marker === 0xd9) {
      return sawScan &&
        frame &&
        scannedComponents.size === frame.components.size &&
        offset === bytes.length
        ? { mimeType: 'image/jpeg', width, height }
        : null
    }
    if (
      marker === 0xd8 ||
      marker === 0x00 ||
      marker === 0x01 ||
      marker === 0xcc ||
      (marker >= 0xd0 && marker <= 0xd7) ||
      UNSUPPORTED_JPEG_SOF.has(marker)
    ) {
      return null
    }
    if (!hasBytes(bytes, offset, 2)) return null
    const segmentLength = uint16Be(bytes, offset)
    if (segmentLength < 2 || !hasBytes(bytes, offset, segmentLength)) return null
    const bodyOffset = offset + 2
    const segmentEnd = offset + segmentLength

    if (SUPPORTED_JPEG_SOF.has(marker)) {
      if (frame || segmentLength < 11 || bytes[bodyOffset] !== 8) return null
      height = uint16Be(bytes, bodyOffset + 1)
      width = uint16Be(bytes, bodyOffset + 3)
      const componentCount = bytes[bodyOffset + 5]!
      if (
        width < 1 ||
        width > 512 ||
        height < 1 ||
        height > 512 ||
        componentCount < 1 ||
        componentCount > 4 ||
        segmentLength !== 8 + componentCount * 3
      ) {
        return null
      }
      const components = new Map<number, number>()
      for (let index = 0; index < componentCount; index += 1) {
        const componentOffset = bodyOffset + 6 + index * 3
        const id = bytes[componentOffset]!
        const sampling = bytes[componentOffset + 1]!
        const quantizationTable = bytes[componentOffset + 2]!
        if (
          components.has(id) ||
          sampling >> 4 < 1 ||
          sampling >> 4 > 4 ||
          (sampling & 0x0f) < 1 ||
          (sampling & 0x0f) > 4 ||
          quantizationTable > 3
        ) {
          return null
        }
        components.set(id, quantizationTable)
      }
      frame = { marker, components }
    } else if (marker === 0xdb) {
      let cursor = bodyOffset
      while (cursor < segmentEnd) {
        const tableInfo = bytes[cursor++]!
        const precision = tableInfo >> 4
        const tableId = tableInfo & 0x0f
        const tableLength = precision === 0 ? 64 : precision === 1 ? 128 : 0
        if (tableId > 3 || tableLength === 0 || cursor + tableLength > segmentEnd) {
          return null
        }
        for (let index = 0; index < tableLength; index += precision + 1) {
          const value = precision === 0 ? bytes[cursor + index]! : uint16Be(bytes, cursor + index)
          if (value === 0) return null
        }
        cursor += tableLength
        quantizationTables.add(tableId)
      }
      if (cursor !== segmentEnd) return null
    } else if (marker === 0xc4) {
      let cursor = bodyOffset
      while (cursor < segmentEnd) {
        const tableInfo = bytes[cursor++]!
        const tableClass = tableInfo >> 4
        const tableId = tableInfo & 0x0f
        if (tableClass > 1 || tableId > 3 || cursor + 16 > segmentEnd) return null
        let symbolCount = 0
        let availableCodes = 1
        for (let index = 0; index < 16; index += 1) {
          const count = bytes[cursor + index]!
          availableCodes = availableCodes * 2 - count
          if (availableCodes < 0) return null
          symbolCount += count
        }
        if (availableCodes === 0) return null
        cursor += 16
        if (symbolCount < 1 || symbolCount > 256 || cursor + symbolCount > segmentEnd) {
          return null
        }
        const symbols = new Set<number>()
        for (let index = 0; index < symbolCount; index += 1) {
          const symbol = bytes[cursor + index]!
          if (
            symbols.has(symbol) ||
            (tableClass === 0 && symbol > 11) ||
            (tableClass === 1 && (symbol & 0x0f) > 10)
          ) {
            return null
          }
          symbols.add(symbol)
        }
        cursor += symbolCount
        if (tableClass === 0) dcTables.add(tableId)
        else acTables.set(tableId, symbols)
      }
      if (cursor !== segmentEnd) return null
    } else if (marker === 0xdd && segmentLength !== 4) {
      return null
    } else if (
      !SUPPORTED_JPEG_SOF.has(marker) &&
      marker !== 0xdb &&
      marker !== 0xc4 &&
      marker !== 0xdd &&
      marker !== 0xda &&
      marker !== 0xfe &&
      !(marker >= 0xe0 && marker <= 0xef)
    ) {
      return null
    }

    offset = segmentEnd
    if (marker !== 0xda) continue
    if (!frame) return null
    const scanComponentCount = bytes[bodyOffset]!
    if (
      scanComponentCount < 1 ||
      scanComponentCount > frame.components.size ||
      segmentLength !== 6 + scanComponentCount * 2
    ) {
      return null
    }
    const spectralStartOffset = bodyOffset + 1 + scanComponentCount * 2
    const spectralStart = bytes[spectralStartOffset]!
    const spectralEnd = bytes[spectralStartOffset + 1]!
    const approximation = bytes[spectralStartOffset + 2]!
    const approximationHigh = approximation >> 4
    const approximationLow = approximation & 0x0f
    if (frame.marker === 0xc2) {
      if (
        (spectralStart === 0 && spectralEnd !== 0) ||
        (spectralStart > 0 &&
          (scanComponentCount !== 1 || spectralStart > spectralEnd || spectralEnd > 63)) ||
        approximationHigh > 13 ||
        approximationLow > 13 ||
        (approximationHigh !== 0 && approximationHigh !== approximationLow + 1)
      ) {
        return null
      }
    } else if (
      spectralStart !== 0 ||
      spectralEnd !== 63 ||
      approximationHigh !== 0 ||
      approximationLow !== 0
    ) {
      return null
    }
    const scanIds = new Set<number>()
    for (let index = 0; index < scanComponentCount; index += 1) {
      const componentOffset = bodyOffset + 1 + index * 2
      const componentId = bytes[componentOffset]!
      const tables = bytes[componentOffset + 1]!
      const dcTable = tables >> 4
      const acTable = tables & 0x0f
      const quantizationTable = frame.components.get(componentId)
      const needsDcTable = frame.marker !== 0xc2 || (spectralStart === 0 && approximationHigh === 0)
      const needsAcTable = frame.marker !== 0xc2 || spectralStart > 0
      const acTableSymbols = acTables.get(acTable)
      if (
        quantizationTable === undefined ||
        scanIds.has(componentId) ||
        dcTable > 3 ||
        acTable > 3 ||
        !quantizationTables.has(quantizationTable) ||
        (needsDcTable && !dcTables.has(dcTable)) ||
        (needsAcTable && !acTableSymbols) ||
        (frame.marker !== 0xc2 &&
          acTableSymbols &&
          [...acTableSymbols].some(
            (symbol) => (symbol & 0x0f) === 0 && symbol !== 0 && symbol !== 0xf0,
          ))
      ) {
        return null
      }
      scanIds.add(componentId)
      scannedComponents.add(componentId)
    }
    sawScan = true
    let scanDataLength = 0
    while (offset < bytes.length) {
      if (bytes[offset] !== 0xff) {
        scanDataLength += 1
        offset += 1
        continue
      }
      let next = offset + 1
      while (bytes[next] === 0xff) next += 1
      if (next >= bytes.length) return null
      const scanMarker = bytes[next]!
      if (scanMarker === 0x00) {
        scanDataLength += 1
        offset = next + 1
        continue
      }
      if (scanMarker >= 0xd0 && scanMarker <= 0xd7) {
        offset = next + 1
        continue
      }
      break
    }
    if (scanDataLength < 1) return null
  }
  return null
}

function normalizedDeclaredMime(contentType: string | null): FaviconMime | 'generic' | 'invalid' {
  if (contentType == null || contentType.trim() === '') return 'generic'
  const mime = contentType.split(';', 1)[0]!.trim().toLowerCase()
  if (mime === 'application/octet-stream' || mime === 'binary/octet-stream') return 'generic'
  if (['image/x-icon', 'image/vnd.microsoft.icon', 'image/ico', 'image/icon'].includes(mime)) {
    return 'image/x-icon'
  }
  if (mime === 'image/png') return 'image/png'
  if (mime === 'image/jpeg' || mime === 'image/jpg') return 'image/jpeg'
  return 'invalid'
}

export function validateFavicon(
  bytes: Uint8Array,
  contentType: string | null = null,
): ValidatedFavicon | null {
  if (bytes.length < 1 || bytes.length > FAVICON_BODY_LIMIT_BYTES) return null
  const parsed = parseIco(bytes) ?? parsePng(bytes) ?? parseJpeg(bytes)
  if (!parsed) return null
  const declared = normalizedDeclaredMime(contentType)
  if (declared === 'invalid' || (declared !== 'generic' && declared !== parsed.mimeType)) {
    return null
  }
  return { bytes, ...parsed }
}

async function readBoundedBody(
  response: Response,
  signal: AbortSignal,
): Promise<Uint8Array | null> {
  const contentLength = response.headers.get('content-length')
  if (
    contentLength &&
    /^\d+$/.test(contentLength) &&
    Number(contentLength) > FAVICON_BODY_LIMIT_BYTES
  ) {
    await response.body?.cancel().catch(() => undefined)
    return null
  }
  if (!response.body) return null

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let length = 0
  try {
    while (true) {
      if (signal.aborted) throw new Error('aborted')
      const result = await reader.read()
      if (result.done) break
      length += result.value.byteLength
      if (length > FAVICON_BODY_LIMIT_BYTES) {
        await reader.cancel().catch(() => undefined)
        return null
      }
      chunks.push(result.value)
    }
  } catch {
    await reader.cancel().catch(() => undefined)
    return null
  } finally {
    reader.releaseLock()
  }

  const body = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }
  return body
}

function cacheKey(bookmark: Bookmark) {
  return createHash('sha256').update(`${bookmark.id}\0${bookmark.url}`).digest('hex')
}

function sameOrigin(candidate: URL, initial: URL) {
  return (
    (candidate.protocol === 'http:' || candidate.protocol === 'https:') &&
    candidate.protocol === initial.protocol &&
    candidate.hostname === initial.hostname &&
    candidate.port === initial.port &&
    !candidate.username &&
    !candidate.password
  )
}

export interface FaviconResolverOptions {
  now?: () => number
  cacheMaxEntries?: number
  concurrency?: number
  deadlineMs?: number
  positiveTtlMs?: number
  negativeTtlMs?: number
}

export class FaviconResolver {
  private readonly cache = new Map<string, CacheEntry>()
  private readonly inflight = new Map<string, InflightEntry>()
  private readonly permits: PermitPool
  private readonly now: () => number
  private readonly cacheMaxEntries: number
  private readonly deadlineMs: number
  private readonly positiveTtlMs: number
  private readonly negativeTtlMs: number

  constructor(
    private readonly fetchImpl: FetchLike = fetch,
    options: FaviconResolverOptions = {},
  ) {
    this.now = options.now ?? Date.now
    this.cacheMaxEntries = options.cacheMaxEntries ?? FAVICON_CACHE_MAX_ENTRIES
    this.deadlineMs = options.deadlineMs ?? FAVICON_DEADLINE_MS
    this.positiveTtlMs = options.positiveTtlMs ?? FAVICON_POSITIVE_TTL_MS
    this.negativeTtlMs = options.negativeTtlMs ?? FAVICON_NEGATIVE_TTL_MS
    this.permits = new PermitPool(options.concurrency ?? 4)
  }

  async resolve(
    bookmark: Bookmark,
    deadlineAtMs = this.now() + this.deadlineMs,
  ): Promise<FaviconOutcome> {
    if (deadlineAtMs <= this.now()) return UNAVAILABLE
    const key = cacheKey(bookmark)
    const hit = this.cache.get(key)
    if (hit) {
      if (hit.expiresAtMs > this.now()) {
        this.cache.delete(key)
        this.cache.set(key, hit)
        return hit.outcome
      }
      this.cache.delete(key)
    }

    const running = this.inflight.get(key)
    if (running) return this.observeUntilDeadline(running.promise, deadlineAtMs)

    const invalidation = { invalidated: false }
    const pending = this.retrieveWithinDeadline(bookmark, deadlineAtMs)
      .then((outcome) => {
        if (!invalidation.invalidated) {
          this.cache.set(key, {
            bookmarkId: bookmark.id,
            outcome,
            expiresAtMs:
              this.now() + (outcome.kind === 'success' ? this.positiveTtlMs : this.negativeTtlMs),
          })
          while (this.cache.size > this.cacheMaxEntries) {
            this.cache.delete(this.cache.keys().next().value as string)
          }
        }
        return outcome
      })
      .finally(() => {
        if (this.inflight.get(key)?.promise === pending) this.inflight.delete(key)
      })
    this.inflight.set(key, { bookmarkId: bookmark.id, promise: pending, invalidation })
    return pending
  }

  invalidateBookmarkId(bookmarkId: string) {
    for (const [key, entry] of this.cache) {
      if (entry.bookmarkId === bookmarkId) this.cache.delete(key)
    }
    for (const [key, entry] of this.inflight) {
      if (entry.bookmarkId === bookmarkId) {
        entry.invalidation.invalidated = true
        this.inflight.delete(key)
      }
    }
  }

  private async observeUntilDeadline(
    outcome: Promise<FaviconOutcome>,
    deadlineAtMs: number,
  ): Promise<FaviconOutcome> {
    let timeout: ReturnType<typeof setTimeout> | undefined
    const expired = new Promise<FaviconOutcome>((resolve) => {
      timeout = setTimeout(() => resolve(UNAVAILABLE), Math.max(0, deadlineAtMs - this.now()))
    })
    try {
      return await Promise.race([outcome, expired])
    } finally {
      if (timeout) clearTimeout(timeout)
    }
  }

  private async retrieveWithinDeadline(
    bookmark: Bookmark,
    deadlineAtMs: number,
  ): Promise<FaviconOutcome> {
    const controller = new AbortController()
    let timeout: ReturnType<typeof setTimeout> | undefined
    const expired = new Promise<FaviconOutcome>((resolve) => {
      timeout = setTimeout(
        () => {
          controller.abort()
          resolve(UNAVAILABLE)
        },
        Math.max(0, deadlineAtMs - this.now()),
      )
    })
    const retrieval = this.permits
      .run(controller.signal, () => this.retrieve(bookmark, controller.signal, deadlineAtMs))
      .catch(() => UNAVAILABLE)
    try {
      return await Promise.race([retrieval, expired])
    } finally {
      if (timeout) clearTimeout(timeout)
    }
  }

  private async retrieve(
    bookmark: Bookmark,
    signal: AbortSignal,
    deadlineAtMs: number,
  ): Promise<FaviconOutcome> {
    let initial: URL
    try {
      const bookmarkUrl = new URL(bookmark.url)
      if (
        (bookmarkUrl.protocol !== 'http:' && bookmarkUrl.protocol !== 'https:') ||
        bookmarkUrl.username ||
        bookmarkUrl.password
      ) {
        return UNAVAILABLE
      }
      initial = new URL('/favicon.ico', bookmarkUrl.origin)
    } catch {
      return UNAVAILABLE
    }

    let target = initial
    let redirects = 0
    while (!signal.aborted && this.now() < deadlineAtMs) {
      let response: Response
      try {
        response = await this.fetchImpl(target, {
          method: 'GET',
          body: null,
          credentials: 'omit',
          redirect: 'manual',
          referrerPolicy: 'no-referrer',
          signal,
        })
      } catch {
        return UNAVAILABLE
      }
      if (signal.aborted || this.now() >= deadlineAtMs) return UNAVAILABLE

      if (REDIRECT_STATUSES.has(response.status)) {
        await response.body?.cancel().catch(() => undefined)
        if (redirects >= 2) return UNAVAILABLE
        const location = response.headers.get('location')
        if (!location) return UNAVAILABLE
        let next: URL
        try {
          next = new URL(location, target)
        } catch {
          return UNAVAILABLE
        }
        if (!sameOrigin(next, initial)) return UNAVAILABLE
        redirects += 1
        target = next
        continue
      }

      if (response.status !== 200) {
        await response.body?.cancel().catch(() => undefined)
        return UNAVAILABLE
      }
      const bytes = await readBoundedBody(response, signal)
      if (!bytes || signal.aborted || this.now() >= deadlineAtMs) return UNAVAILABLE
      const image = validateFavicon(bytes, response.headers.get('content-type'))
      return image && !signal.aborted && this.now() < deadlineAtMs
        ? { kind: 'success', image }
        : UNAVAILABLE
    }
    return UNAVAILABLE
  }
}
