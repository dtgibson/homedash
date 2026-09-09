import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Bookmark } from '../shared/contracts'
import { BookmarkGroups } from './Bookmarks'

const bookmarks: Bookmark[] = [
  {
    id: '0123456789abcdef',
    group: 'Daily',
    name: 'Gmail — personal inbox',
    url: 'https://mail.google.com/mail/u/0/#inbox',
    order: 0,
  },
  {
    id: '1111111111111111',
    group: 'Daily',
    name: 'Calendar',
    url: 'https://calendar.google.com',
    order: 1,
  },
  {
    id: '2222222222222222',
    group: 'Projects',
    name: 'GitHub',
    url: 'https://github.com',
    order: 2,
  },
]

describe('BookmarkGroups', () => {
  it('preserves host group and file order with native same-tab destinations', () => {
    const { container, rerender } = render(<BookmarkGroups bookmarks={bookmarks} />)
    const links = screen.getAllByRole('link')
    expect(links.map((link) => link.querySelector('.bookmark-name')?.textContent)).toEqual([
      'Gmail — personal inbox',
      'Calendar',
      'GitHub',
    ])
    expect(links.map((link) => link.getAttribute('href'))).toEqual(bookmarks.map(({ url }) => url))
    expect(links.every((link) => !link.hasAttribute('target'))).toBe(true)
    expect(container.querySelectorAll('nav').length).toBe(2)

    rerender(<BookmarkGroups dense bookmarks={bookmarks} />)
    expect(screen.getAllByRole('link').map((link) => link.textContent)).toEqual([
      'Gmail — personal inbox',
      'Calendar',
      'GitHub',
    ])
  })

  it('keeps the complete bookmark name as the only accessible link name', () => {
    const { container } = render(<BookmarkGroups bookmarks={[bookmarks[0]!]} />)
    const link = screen.getByRole('link', { name: 'Gmail — personal inbox' })
    expect(link).toHaveTextContent('Gmail — personal inbox')
    expect(link).not.toHaveAttribute('aria-label')
    expect(within(link).queryByRole('img')).not.toBeInTheDocument()
    expect(container.querySelector('.bookmark-mark')).toHaveAttribute('aria-hidden', 'true')
    expect(container.querySelector('.bookmark-favicon')).toHaveAttribute('alt', '')
  })

  it('reserves the fallback slot until a same-origin favicon loads and restores it on failure', () => {
    const { container } = render(<BookmarkGroups bookmarks={[bookmarks[0]!]} />)
    const image = container.querySelector<HTMLImageElement>('.bookmark-favicon')!
    expect(image.getAttribute('src')).toBe('/api/bookmarks/0123456789abcdef/favicon')
    expect(image).toHaveAttribute('data-loaded', 'false')
    expect(container.querySelector('.bookmark-fallback')).toBeInTheDocument()

    fireEvent.load(image)
    expect(image).toHaveAttribute('data-loaded', 'true')
    expect(container.querySelector('.bookmark-fallback')).not.toBeInTheDocument()

    fireEvent.error(image)
    expect(container.querySelector('.bookmark-favicon')).not.toBeInTheDocument()
    expect(container.querySelector('.bookmark-fallback')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Gmail — personal inbox' })).toHaveAttribute(
      'href',
      bookmarks[0]!.url,
    )
  })

  it('uses one anchor activation area for icon, label, and target padding', () => {
    const { container } = render(<BookmarkGroups bookmarks={[bookmarks[0]!]} />)
    const link = screen.getByRole('link', { name: 'Gmail — personal inbox' })
    const activated = vi.fn((event: Event) => event.preventDefault())
    link.addEventListener('click', activated)
    fireEvent.click(container.querySelector('.bookmark-mark')!)
    fireEvent.click(container.querySelector('.bookmark-name')!)
    fireEvent.click(link)
    expect(activated).toHaveBeenCalledTimes(3)
  })
})
