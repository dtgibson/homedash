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

export function BookmarkFavicon({ bookmarkId }: { bookmarkId: string }) {
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
      {!loaded && (
        <svg
          className="bookmark-fallback"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M6 4h12v16l-6-4-6 4z" />
        </svg>
      )}
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
            className={dense ? undefined : 'bookmark-group'}
            aria-label={`${group} bookmarks`}
            key={group}
          >
            <h3>{group}</h3>
            {links.map((bookmark) => (
              <a className="bookmark-link" href={bookmark.url} key={bookmark.id}>
                <BookmarkFavicon bookmarkId={bookmark.id} />
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
