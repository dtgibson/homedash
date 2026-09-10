import { useState } from 'react'
import type { Bookmark } from '../shared/contracts'

function groupBookmarks(bookmarks: Bookmark[], sections: string[]) {
  const groups = new Map<string, Bookmark[]>()
  for (const section of sections) groups.set(section, [])
  for (const bookmark of bookmarks) {
    const current = groups.get(bookmark.group) ?? []
    current.push(bookmark)
    groups.set(bookmark.group, current)
  }
  return [...groups.entries()]
}

function bookmarkFallbackLabel(name: string) {
  const parts =
    name
      .trim()
      .match(/\p{Lu}?\p{Ll}+|\p{Lu}+(?!\p{Ll})|\p{N}+/gu)
      ?.filter(Boolean) ?? []
  const characters =
    parts.length > 1
      ? [Array.from(parts[0]!)[0], Array.from(parts[1]!)[0]]
      : Array.from(parts[0] ?? name.trim()).slice(0, 2)
  return Array.from(characters.filter(Boolean).join('').toUpperCase()).slice(0, 2).join('') || 'BM'
}

export function BookmarkFavicon({ bookmarkId, name }: { bookmarkId: string; name: string }) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const safeBookmarkId = /^[a-f0-9]{16}$/.test(bookmarkId)
  const source = safeBookmarkId ? `/api/bookmarks/${bookmarkId}/favicon` : null

  return (
    <span className="bookmark-mark" aria-hidden="true">
      {!failed && source && (
        <img
          className="bookmark-favicon"
          src={source}
          alt=""
          aria-hidden="true"
          data-loaded={loaded ? 'true' : 'false'}
          onLoad={() => setLoaded(true)}
          onError={() => {
            setLoaded(false)
            setFailed(true)
          }}
        />
      )}
      {!loaded && <span className="bookmark-fallback">{bookmarkFallbackLabel(name)}</span>}
    </span>
  )
}

export function BookmarkGroups({
  bookmarks,
  sections,
  dense = false,
}: {
  bookmarks: Bookmark[]
  sections: string[]
  dense?: boolean
}) {
  const groups = groupBookmarks(bookmarks, sections)
  if (!sections.length) return <p className="empty-copy">No valid bookmarks are configured.</p>
  return (
    <div className="bookmark-scroll">
      <div className={dense ? 'dense-bookmarks' : 'bookmark-columns'}>
        {groups.map(([group, links]) => (
          <nav
            className={[
              dense ? null : 'bookmark-group',
              links.length ? 'has-bookmarks' : 'is-empty',
            ]
              .filter(Boolean)
              .join(' ')}
            aria-label={`${group} bookmarks`}
            key={group}
          >
            <h3>{group}</h3>
            {links.map((bookmark) => (
              <a className="bookmark-link" href={bookmark.url} key={bookmark.id}>
                <BookmarkFavicon bookmarkId={bookmark.id} name={bookmark.name} />
                <span className="bookmark-name">{bookmark.name}</span>
                {!dense && (
                  <span className="bookmark-arrow" aria-hidden="true">
                    ↗
                  </span>
                )}
              </a>
            ))}
            {!links.length && <span className="empty-bookmark-section">No bookmarks</span>}
          </nav>
        ))}
      </div>
    </div>
  )
}
