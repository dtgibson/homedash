import { describe, expect, it, vi } from 'vitest'
import { deflateSync } from 'node:zlib'
import type { Bookmark } from '../src/shared/contracts'
import {
  FAVICON_BODY_LIMIT_BYTES,
  FAVICON_ICO_MAX_ENTRIES,
  FaviconResolver,
  isPublicFaviconAddress,
  validateFavicon,
} from './favicon'

// Pillow 12.2.0: Image.new('RGB', (64, 48), (0, 0, 17)).save(..., progressive=True)
const PILLOW_PROGRESSIVE_JPEG = Buffer.from(
  [
    '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIs',
    'IxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIy',
    'MjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wgARCAAwAEADASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAA',
    'AAb/xAAWAQEBAQAAAAAAAAAAAAAAAAAAAQL/2gAMAwEAAhADEAAAAYAbgAAAAAAAAAAH/8QAFBABAAAAAAAAAAAAAAAA',
    'AAAAUP/aAAgBAQABBQJD/8QAFBEBAAAAAAAAAAAAAAAAAAAAMP/aAAgBAwEBPwFP/8QAFBEBAAAAAAAAAAAAAAAAAAAA',
    'MP/aAAgBAgEBPwFP/8QAFBABAAAAAAAAAAAAAAAAAAAAUP/aAAgBAQAGPwJD/8QAFBABAAAAAAAAAAAAAAAAAAAAUP/a',
    'AAgBAQABPyFD/9oADAMBAAIAAwAAABAMMMMMMMMMMMP/xAAUEQEAAAAAAAAAAAAAAAAAAAAw/9oACAEDAQE/EE//xAAU',
    'EQEAAAAAAAAAAAAAAAAAAAAw/9oACAECAQE/EE//xAAUEAEAAAAAAAAAAAAAAAAAAABQ/9oACAEBAAE/EEP/2Q==',
  ].join(''),
  'base64',
)

interface PngOptions {
  animated?: boolean
  compressed?: Uint8Array
  interlace?: 0 | 1
  raw?: Uint8Array
}

function pngRawBytes(width: number, height: number, interlace: 0 | 1) {
  const passes =
    interlace === 0
      ? ([[0, 0, 1, 1]] as const)
      : ([
          [0, 0, 8, 8],
          [4, 0, 8, 8],
          [0, 4, 4, 8],
          [2, 0, 4, 4],
          [0, 2, 2, 4],
          [1, 0, 2, 2],
          [0, 1, 1, 2],
        ] as const)
  const rows: Buffer[] = []
  for (const [startX, startY, stepX, stepY] of passes) {
    const passWidth = width <= startX ? 0 : Math.ceil((width - startX) / stepX)
    const passHeight = height <= startY ? 0 : Math.ceil((height - startY) / stepY)
    for (let row = 0; row < passHeight; row += 1) rows.push(Buffer.alloc(1 + passWidth * 4))
  }
  return Buffer.concat(rows)
}

function png(width = 1, height = 1, options: PngOptions = {}) {
  const crc32 = (bytes: Uint8Array) => {
    let crc = 0xffffffff
    for (const byte of bytes) {
      crc ^= byte
      for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
    }
    return (crc ^ 0xffffffff) >>> 0
  }
  const chunk = (name: string, data: Uint8Array) => {
    const value = Buffer.alloc(12 + data.length)
    value.writeUInt32BE(data.length, 0)
    value.write(name, 4, 4, 'ascii')
    Buffer.from(data).copy(value, 8)
    value.writeUInt32BE(crc32(value.subarray(4, 8 + data.length)), 8 + data.length)
    return value
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  const interlace = options.interlace ?? 0
  header.set([8, 6, 0, 0, interlace], 8)
  const compressed =
    options.compressed ?? deflateSync(options.raw ?? pngRawBytes(width, height, interlace))
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    ...(options.animated ? [chunk('acTL', Buffer.from([0, 0, 0, 1, 0, 0, 0, 0]))] : []),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function ico(width = 16, height = 16, bitDepth = width >= 256 ? 1 : 32) {
  const paletteColors = bitDepth <= 8 ? 2 ** bitDepth : 0
  const xorLength = Math.ceil((width * bitDepth) / 32) * 4 * height
  const andLength = Math.ceil(width / 32) * 4 * height
  const bodyLength = 40 + paletteColors * 4 + xorLength + andLength
  const value = Buffer.alloc(22 + bodyLength)
  value.set(
    [
      0,
      0,
      1,
      0,
      1,
      0,
      width === 256 ? 0 : width,
      height === 256 ? 0 : height,
      paletteColors >= 256 ? 0 : paletteColors,
      0,
    ],
    0,
  )
  value.writeUInt16LE(1, 10)
  value.writeUInt16LE(bitDepth, 12)
  value.writeUInt32LE(bodyLength, 14)
  value.writeUInt32LE(22, 18)
  value.writeUInt32LE(40, 22)
  value.writeInt32LE(width, 26)
  value.writeInt32LE(height * 2, 30)
  value.writeUInt16LE(1, 34)
  value.writeUInt16LE(bitDepth, 36)
  value.writeUInt32LE(xorLength, 42)
  if (paletteColors > 1) value.fill(0xff, 22 + 40 + 4, 22 + 40 + 8)
  return value
}

function icoWithPngBodies(entries: Array<{ body: Uint8Array; width: number; height: number }>) {
  const directoryLength = 6 + entries.length * 16
  const value = Buffer.alloc(
    directoryLength + entries.reduce((length, entry) => length + entry.body.byteLength, 0),
  )
  value.writeUInt16LE(1, 2)
  value.writeUInt16LE(entries.length, 4)
  let bodyOffset = directoryLength
  entries.forEach((entry, index) => {
    const directoryOffset = 6 + index * 16
    value[directoryOffset] = entry.width === 256 ? 0 : entry.width
    value[directoryOffset + 1] = entry.height === 256 ? 0 : entry.height
    value.writeUInt32LE(entry.body.byteLength, directoryOffset + 8)
    value.writeUInt32LE(bodyOffset, directoryOffset + 12)
    value.set(entry.body, bodyOffset)
    bodyOffset += entry.body.byteLength
  })
  return value
}

interface JpegOptions {
  acSymbol?: number
  huffmanTables?: boolean
  quantizationTable?: boolean
  scanData?: Uint8Array
}

function jpeg(width = 1, height = 1, options: JpegOptions = {}) {
  const segment = (marker: number, body: Uint8Array) => {
    const result = Buffer.alloc(body.byteLength + 4)
    result.set([0xff, marker], 0)
    result.writeUInt16BE(body.byteLength + 2, 2)
    result.set(body, 4)
    return result
  }
  const quantization = segment(0xdb, Buffer.from([0, ...Array<number>(64).fill(1)]))
  const huffmanDefinition = (tableClass: number) =>
    Buffer.from([
      tableClass << 4,
      1,
      ...Array<number>(15).fill(0),
      tableClass === 1 ? (options.acSymbol ?? 0) : 0,
    ])
  const huffman = segment(0xc4, Buffer.concat([huffmanDefinition(0), huffmanDefinition(1)]))
  const frame = segment(
    0xc0,
    Buffer.from([8, height >> 8, height & 0xff, width >> 8, width & 0xff, 1, 1, 0x11, 0]),
  )
  const scan = segment(0xda, Buffer.from([1, 1, 0, 0, 63, 0]))
  const blockCount = Math.ceil(width / 8) * Math.ceil(height / 8)
  const defaultScanData = Buffer.alloc(Math.ceil((blockCount * 2) / 8))
  const unusedBits = defaultScanData.byteLength * 8 - blockCount * 2
  if (unusedBits > 0) defaultScanData[defaultScanData.length - 1] = 2 ** unusedBits - 1
  return Buffer.concat([
    Buffer.from([0xff, 0xd8]),
    ...(options.quantizationTable === false ? [] : [quantization]),
    ...(options.huffmanTables === false ? [] : [huffman]),
    frame,
    scan,
    Buffer.from(options.scanData ?? defaultScanData),
    Buffer.from([0xff, 0xd9]),
  ])
}

function bookmark(id: string, url = `https://${id}.example/path?q=private#section`): Bookmark {
  return { id, group: 'Daily', name: id, url, order: 0 }
}

function imageResponse(body = png(), contentType = 'image/png') {
  return new Response(body, { status: 200, headers: { 'content-type': contentType } })
}

describe('favicon image validation', () => {
  it.each([
    ['ICO', ico(), 'image/x-icon', 16, 16],
    ['largest ICO', ico(256, 256), 'image/x-icon', 256, 256],
    ['PNG', png(32, 24), 'image/png', 32, 24],
    ['interlaced PNG', png(9, 9, { interlace: 1 }), 'image/png', 9, 9],
    ['largest PNG', png(512, 512), 'image/png', 512, 512],
    ['JPEG', jpeg(48, 40), 'image/jpeg', 48, 40],
    ['progressive JPEG', PILLOW_PROGRESSIVE_JPEG, 'image/jpeg', 64, 48],
    ['largest JPEG', jpeg(512, 512), 'image/jpeg', 512, 512],
  ] as const)('accepts bounded non-animated %s bytes', (_name, bytes, mime, width, height) => {
    const result = validateFavicon(bytes)
    expect(result).toMatchObject({ mimeType: mime, width, height })
    expect(result?.bytes).toBe(bytes)
  })

  it.each([
    ['empty', Buffer.alloc(0), null],
    ['oversized', Buffer.alloc(FAVICON_BODY_LIMIT_BYTES + 1), null],
    ['HTML', Buffer.from('<!doctype html><title>not an icon</title>'), 'text/html'],
    ['SVG', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'), 'image/svg+xml'],
    ['GIF', Buffer.from('GIF89a'), 'image/gif'],
    ['WebP', Buffer.from('RIFF0000WEBP'), 'image/webp'],
    ['APNG', png(1, 1, { animated: true }), 'image/png'],
    ['wide PNG', png(513, 1), 'image/png'],
    ['wide JPEG', jpeg(513, 1), 'image/jpeg'],
    ['truncated ICO', ico().subarray(0, 62), 'image/x-icon'],
    ['PNG with an invalid zlib stream', png(1, 1, { compressed: Buffer.from([0]) }), 'image/png'],
    [
      'PNG with trailing compressed-stream garbage',
      png(1, 1, {
        compressed: Buffer.concat([deflateSync(pngRawBytes(1, 1, 0)), Buffer.from([1, 2, 3])]),
      }),
      'image/png',
    ],
    ['PNG with a short scanline', png(1, 1, { raw: Buffer.alloc(4) }), 'image/png'],
    [
      'PNG with a forbidden filter byte',
      png(1, 1, { raw: Buffer.from([5, 0, 0, 0, 0]) }),
      'image/png',
    ],
    [
      'interlaced PNG with non-interlaced scanlines',
      png(9, 9, { interlace: 1, raw: pngRawBytes(9, 9, 0) }),
      'image/png',
    ],
    ['JPEG without a quantization table', jpeg(1, 1, { quantizationTable: false }), 'image/jpeg'],
    ['JPEG without Huffman tables', jpeg(1, 1, { huffmanTables: false }), 'image/jpeg'],
    ['JPEG with an empty scan', jpeg(1, 1, { scanData: Buffer.alloc(0) }), 'image/jpeg'],
    [
      'sequential JPEG with a progressive-only EOB-run symbol',
      jpeg(1, 1, { acSymbol: 0x50 }),
      'image/jpeg',
    ],
    ['truncated JPEG', jpeg().subarray(0, -1), 'image/jpeg'],
  ] as const)('rejects %s content', (_name, bytes, type) => {
    expect(validateFavicon(bytes, type)).toBeNull()
  })

  it('rejects bounded DIB ICO shells without their required palette, XOR, and AND data', () => {
    const withoutPixels = Buffer.from(ico())
    withoutPixels.writeUInt32LE(40, 14)
    expect(validateFavicon(withoutPixels.subarray(0, 62), 'image/x-icon')).toBeNull()

    const withoutPaletteOrPixels = Buffer.from(ico(16, 16, 1))
    withoutPaletteOrPixels.writeUInt32LE(40, 14)
    expect(validateFavicon(withoutPaletteOrPixels.subarray(0, 62), 'image/x-icon')).toBeNull()
  })

  it('accepts non-overlapping ICO bodies and rejects duplicate or overlapping ranges', () => {
    const first = png(16, 16)
    const second = png(32, 32)
    const valid = icoWithPngBodies([
      { body: first, width: 16, height: 16 },
      { body: second, width: 32, height: 32 },
    ])
    expect(validateFavicon(valid, 'image/x-icon')).toMatchObject({ width: 32, height: 32 })

    const firstBodyOffset = valid.readUInt32LE(18)
    const duplicate = Buffer.from(valid)
    duplicate.writeUInt32LE(firstBodyOffset, 34)
    expect(validateFavicon(duplicate, 'image/x-icon')).toBeNull()

    const overlapping = Buffer.from(valid)
    overlapping.writeUInt32LE(firstBodyOffset + 1, 34)
    expect(validateFavicon(overlapping, 'image/x-icon')).toBeNull()
  })

  it('rejects ICO directory and cumulative decompression work above fixed bounds', () => {
    const tiny = png()
    expect(
      validateFavicon(
        icoWithPngBodies(
          Array.from({ length: FAVICON_ICO_MAX_ENTRIES + 1 }, () => ({
            body: tiny,
            width: 1,
            height: 1,
          })),
        ),
        'image/x-icon',
      ),
    ).toBeNull()

    const maximum = png(256, 256)
    expect(
      validateFavicon(
        icoWithPngBodies(
          Array.from({ length: FAVICON_ICO_MAX_ENTRIES }, () => ({
            body: maximum,
            width: 256,
            height: 256,
          })),
        ),
        'image/x-icon',
      ),
    ).toBeNull()
  })

  it('keeps rejecting a table-complete SOF2 shell with an invalid sequential scan shape', () => {
    const shell = Buffer.from(jpeg())
    const frameMarker = shell.indexOf(Buffer.from([0xff, 0xc0]))
    expect(frameMarker).toBeGreaterThan(0)
    shell[frameMarker + 1] = 0xc2
    expect(validateFavicon(shell, 'image/jpeg')).toBeNull()
  })

  it('rejects a supported declared type that contradicts the signature', () => {
    expect(validateFavicon(png(), 'image/jpeg')).toBeNull()
    expect(validateFavicon(jpeg(), 'image/png')).toBeNull()
    expect(validateFavicon(png(), 'application/octet-stream')).not.toBeNull()
  })

  it('normalizes a raster favicon served under an icon container media type', () => {
    expect(validateFavicon(png(), 'image/vnd.microsoft.icon')).toMatchObject({
      mimeType: 'image/png',
    })
  })

  it('rejects a PNG with a corrupt chunk checksum', () => {
    const corrupted = Buffer.from(png())
    corrupted[corrupted.length - 1] ^= 1
    expect(validateFavicon(corrupted, 'image/png')).toBeNull()
  })
})

describe('FaviconResolver', () => {
  it('derives the fixed origin path, follows same-origin redirects, and sends no credentials', async () => {
    const requests: Array<{ url: string; init: RequestInit | undefined }> = []
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = input.toString()
      requests.push({ url, init })
      if (requests.length === 1) {
        return new Response(null, { status: 302, headers: { location: '/assets/site.ico' } })
      }
      if (requests.length === 2) {
        return new Response(null, {
          status: 307,
          headers: { location: 'https://icons.example/final.ico' },
        })
      }
      return imageResponse()
    })
    const resolver = new FaviconResolver(fetchMock as typeof fetch)

    await expect(
      resolver.resolve(bookmark('0123456789abcdef', 'https://icons.example/private?q=secret#part')),
    ).resolves.toMatchObject({ kind: 'success' })
    expect(requests.map((request) => request.url)).toEqual([
      'https://icons.example/favicon.ico',
      'https://icons.example/assets/site.ico',
      'https://icons.example/final.ico',
    ])
    for (const request of requests) {
      expect(request.init).toMatchObject({
        method: 'GET',
        body: null,
        credentials: 'omit',
        redirect: 'manual',
        referrerPolicy: 'no-referrer',
      })
      expect(request.init?.headers).toBeUndefined()
    }
  })

  it('follows one HTTPS redirect origin through a public-address-pinned dispatcher', async () => {
    const requests: Array<{ url: string; init?: RequestInit & { dispatcher?: unknown } }> = []
    const resolver = new FaviconResolver(
      vi.fn(async (input, init) => {
        requests.push({ url: input.toString(), init })
        return requests.length === 1
          ? new Response(null, {
              status: 302,
              headers: { location: 'https://static.cdn.example/icons/site.ico' },
            })
          : imageResponse()
      }) as typeof fetch,
    )

    await expect(
      resolver.resolve(bookmark('0123456789abcdef', 'https://origin.example/path')),
    ).resolves.toMatchObject({ kind: 'success' })
    expect(requests.map(({ url }) => url)).toEqual([
      'https://origin.example/favicon.ico',
      'https://static.cdn.example/icons/site.ico',
    ])
    expect(requests[0]!.init).not.toHaveProperty('dispatcher')
    expect(requests[1]!.init?.dispatcher).toBeDefined()
    expect(requests[1]!.init).toMatchObject({
      credentials: 'omit',
      redirect: 'manual',
      referrerPolicy: 'no-referrer',
    })
  })

  it.each([
    ['scheme', 'http://origin.example/next.ico'],
    ['port', 'https://origin.example:444/next.ico'],
    ['credentials', 'https://user:secret@origin.example/next.ico'],
    ['loopback address', 'https://127.0.0.1/next.ico'],
    ['local IPv6 address', 'https://[::1]/next.ico'],
    ['local hostname', 'https://service.local/next.ico'],
  ])('rejects a redirect with changed %s before contacting it', async (_name, location) => {
    const requested: string[] = []
    const resolver = new FaviconResolver(
      vi.fn(async (input) => {
        requested.push(input.toString())
        return new Response(null, { status: 302, headers: { location } })
      }) as typeof fetch,
    )
    await expect(
      resolver.resolve(bookmark('0123456789abcdef', 'https://origin.example/path')),
    ).resolves.toEqual({ kind: 'unavailable' })
    expect(requested).toEqual(['https://origin.example/favicon.ico'])
  })

  it('rejects a second cross-origin redirect before contacting it', async () => {
    const requested: string[] = []
    const resolver = new FaviconResolver(
      vi.fn(async (input) => {
        requested.push(input.toString())
        return new Response(null, {
          status: 302,
          headers: {
            location:
              requested.length === 1
                ? 'https://static.cdn.example/site.ico'
                : 'https://other-cdn.example/site.ico',
          },
        })
      }) as typeof fetch,
    )
    await expect(
      resolver.resolve(bookmark('0123456789abcdef', 'https://origin.example/path')),
    ).resolves.toEqual({ kind: 'unavailable' })
    expect(requested).toEqual([
      'https://origin.example/favicon.ico',
      'https://static.cdn.example/site.ico',
    ])
  })

  it.each([
    ['8.8.8.8', true],
    ['2606:4700:4700::1111', true],
    ['127.0.0.1', false],
    ['10.0.0.1', false],
    ['100.64.1.1', false],
    ['169.254.1.1', false],
    ['192.168.1.1', false],
    ['::1', false],
    ['::ffff:127.0.0.1', false],
    ['2001:db8::1', false],
    ['3fff::1', false],
    ['fc00::1', false],
    ['fe80::1', false],
  ])('classifies redirect address %s as public=%s', (address, expected) => {
    expect(isPublicFaviconAddress(address)).toBe(expected)
  })

  it('rejects a third redirect without contacting the fourth destination', async () => {
    const requested: string[] = []
    const resolver = new FaviconResolver(
      vi.fn(async (input) => {
        requested.push(input.toString())
        return new Response(null, {
          status: 302,
          headers: { location: `/hop-${requested.length}.ico` },
        })
      }) as typeof fetch,
    )
    await expect(
      resolver.resolve(bookmark('0123456789abcdef', 'https://origin.example/path')),
    ).resolves.toEqual({ kind: 'unavailable' })
    expect(requested).toEqual([
      'https://origin.example/favicon.ico',
      'https://origin.example/hop-1.ico',
      'https://origin.example/hop-2.ico',
    ])
  })

  it('coalesces misses and caches positive and negative outcomes for their own TTLs', async () => {
    let now = 1_000
    let calls = 0
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const resolver = new FaviconResolver(
      vi.fn(async () => {
        calls += 1
        if (calls === 1) await gate
        return calls <= 2 ? imageResponse() : new Response(null, { status: 404 })
      }) as typeof fetch,
      { now: () => now, positiveTtlMs: 100, negativeTtlMs: 20 },
    )
    const target = bookmark('0123456789abcdef')
    const first = resolver.resolve(target)
    const second = resolver.resolve(target)
    release()
    await expect(Promise.all([first, second])).resolves.toMatchObject([
      { kind: 'success' },
      { kind: 'success' },
    ])
    expect(calls).toBe(1)
    await resolver.resolve(target)
    expect(calls).toBe(1)

    now += 101
    await expect(resolver.resolve(target)).resolves.toMatchObject({ kind: 'success' })
    expect(calls).toBe(2)
    now += 101
    await expect(resolver.resolve(target)).resolves.toEqual({ kind: 'unavailable' })
    expect(calls).toBe(3)
    now += 19
    await resolver.resolve(target)
    expect(calls).toBe(3)
    now += 2
    await resolver.resolve(target)
    expect(calls).toBe(4)
  })

  it('evicts the least-recently-used result at the configured cache bound', async () => {
    const fetchMock = vi.fn(async () => imageResponse())
    const resolver = new FaviconResolver(fetchMock as typeof fetch, { cacheMaxEntries: 2 })
    const first = bookmark('0000000000000001')
    const second = bookmark('0000000000000002')
    const third = bookmark('0000000000000003')
    await resolver.resolve(first)
    await resolver.resolve(second)
    await resolver.resolve(first)
    await resolver.resolve(third)
    await resolver.resolve(second)
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })

  it('keeps the production LRU at 128 outcomes', async () => {
    const fetchMock = vi.fn(async () => imageResponse())
    const resolver = new FaviconResolver(fetchMock as typeof fetch)
    const targets = Array.from({ length: 129 }, (_, index) =>
      bookmark(index.toString(16).padStart(16, '0')),
    )
    for (const target of targets.slice(0, 128)) await resolver.resolve(target)
    await resolver.resolve(targets[0]!)
    await resolver.resolve(targets[128]!)
    await resolver.resolve(targets[1]!)
    expect(fetchMock).toHaveBeenCalledTimes(130)
  })

  it('drops a bookmark result when current membership invalidates its ID', async () => {
    const fetchMock = vi.fn(async () => imageResponse())
    const resolver = new FaviconResolver(fetchMock as typeof fetch)
    const target = bookmark('0123456789abcdef')
    await resolver.resolve(target)
    await resolver.resolve(target)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    resolver.invalidateBookmarkId(target.id)
    await resolver.resolve(target)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does not cache a retrieval that was invalidated while in flight', async () => {
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const fetchMock = vi.fn(async () => {
      if (fetchMock.mock.calls.length === 1) await gate
      return imageResponse()
    })
    const resolver = new FaviconResolver(fetchMock as typeof fetch)
    const target = bookmark('0123456789abcdef')

    const stale = resolver.resolve(target)
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    resolver.invalidateBookmarkId(target.id)
    release()
    await expect(stale).resolves.toMatchObject({ kind: 'success' })
    await expect(resolver.resolve(target)).resolves.toMatchObject({ kind: 'success' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('retains no resolver bookkeeping for high-cardinality unknown ID invalidation', () => {
    const fetchMock = vi.fn(async () => imageResponse())
    const resolver = new FaviconResolver(fetchMock as typeof fetch)

    for (let index = 0; index < 4_096; index += 1) {
      resolver.invalidateBookmarkId(index.toString(16).padStart(16, '0'))
    }

    const resolverRecord = resolver as unknown as Record<PropertyKey, unknown>
    const retainedMapEntries = Reflect.ownKeys(resolverRecord).reduce((total, key) => {
      const value = resolverRecord[key]
      return total + (value instanceof Map ? value.size : 0)
    }, 0)
    expect(retainedMapEntries).toBe(0)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('never runs more than four distinct upstream requests concurrently', async () => {
    let active = 0
    let maximum = 0
    let calls = 0
    const releases: Array<() => void> = []
    const resolver = new FaviconResolver(
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            calls += 1
            active += 1
            maximum = Math.max(maximum, active)
            releases.push(() => {
              active -= 1
              resolve(imageResponse())
            })
          }),
      ) as typeof fetch,
      { deadlineMs: 5_000 },
    )
    const pending = Array.from({ length: 7 }, (_, index) =>
      resolver.resolve(bookmark(index.toString(16).padStart(16, '0'))),
    )
    await vi.waitFor(() => expect(calls).toBe(4))
    releases.splice(0).forEach((release) => release())
    await vi.waitFor(() => expect(calls).toBe(7))
    releases.splice(0).forEach((release) => release())
    await expect(Promise.all(pending)).resolves.toHaveLength(7)
    expect(maximum).toBe(4)
  })

  it('resolves unavailable within one deadline even when fetch does not settle', async () => {
    const resolver = new FaviconResolver(
      vi.fn(() => new Promise<Response>(() => undefined)) as typeof fetch,
      { deadlineMs: 25 },
    )
    const started = performance.now()
    await expect(resolver.resolve(bookmark('0123456789abcdef'))).resolves.toEqual({
      kind: 'unavailable',
    })
    expect(performance.now() - started).toBeLessThan(250)
  })

  it('rejects an advertised or streamed body above the decoded-byte bound', async () => {
    const resolver = new FaviconResolver(
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(Buffer.from([1]), {
            status: 200,
            headers: { 'content-type': 'image/png', 'content-length': '131073' },
          }),
        )
        .mockResolvedValueOnce(
          new Response(Buffer.alloc(FAVICON_BODY_LIMIT_BYTES + 1), {
            status: 200,
            headers: { 'content-type': 'application/octet-stream' },
          }),
        ) as typeof fetch,
    )
    await expect(resolver.resolve(bookmark('0000000000000001'))).resolves.toEqual({
      kind: 'unavailable',
    })
    await expect(resolver.resolve(bookmark('0000000000000002'))).resolves.toEqual({
      kind: 'unavailable',
    })
  })
})
