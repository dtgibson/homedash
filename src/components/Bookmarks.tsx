import { useState } from 'react'
import type { Bookmark } from '../shared/contracts'

function groupBookmarks(bookmarks: Bookmark[]) {
  const groups = new Map<string, Bookmark[]>()
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
  const source = `/api/bookmarks/${encodeURIComponent(bookmarkId)}/favicon`

  return (
    <span className="bookmark-mark" aria-hidden="true">
      {!failed && (
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
  dense = false,
}: {
  bookmarks: Bookmark[]
  dense?: boolean
}) {
  const groups = groupBookmarks(bookmarks)
  if (!bookmarks.length) return <p className="empty-copy">No valid bookmarks are configured.</p>
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
          </nav>
        ))}
      </div>
    </div>
  )
}
