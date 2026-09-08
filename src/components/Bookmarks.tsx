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
    <div className={dense ? 'dense-bookmarks' : 'bookmark-columns'}>
      {groups.map(([group, links]) => (
        <nav
          className={dense ? undefined : 'bookmark-group'}
          aria-label={`${group} bookmarks`}
          key={group}
        >
          <h3>{group}</h3>
          {links.map((bookmark) => (
            <a href={bookmark.url} key={bookmark.id}>
              {bookmark.name}
            </a>
          ))}
        </nav>
      ))}
    </div>
  )
}
