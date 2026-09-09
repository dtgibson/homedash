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
    const { container, rerender } = render(
      <BookmarkGroups bookmarks={bookmarks} sections={['Daily', 'Projects']} />,
    )
    const links = screen.getAllByRole('link')
    expect(links.map((link) => link.querySelector('.bookmark-name')?.textContent)).toEqual([
      'Gmail — personal inbox',
      'Calendar',
      'GitHub',
    ])
    expect(links.map((link) => link.getAttribute('href'))).toEqual(bookmarks.map(({ url }) => url))
    expect(links.every((link) => !link.hasAttribute('target'))).toBe(true)
    expect(container.querySelectorAll('nav').length).toBe(2)

    rerender(<BookmarkGroups dense bookmarks={bookmarks} sections={['Daily', 'Projects']} />)
    expect(screen.getAllByRole('link').map((link) => link.textContent)).toEqual([
      'Gmail — personal inbox',
      'Calendar',
      'GitHub',
    ])
  })

  it('keeps the complete bookmark name as the only accessible link name', () => {
    const { container } = render(
      <BookmarkGroups bookmarks={[bookmarks[0]!]} sections={['Daily']} />,
    )
    const link = screen.getByRole('link', { name: 'Gmail — personal inbox' })
    expect(link).toHaveTextContent('Gmail — personal inbox')
    expect(link).not.toHaveAttribute('aria-label')
    expect(within(link).queryByRole('img')).not.toBeInTheDocument()
    expect(container.querySelector('.bookmark-mark')).toHaveAttribute('aria-hidden', 'true')
    expect(container.querySelector('.bookmark-favicon')).toHaveAttribute('alt', '')
  })

  it('reserves the fallback slot until a same-origin favicon loads and restores it on failure', () => {
    const { container } = render(
      <BookmarkGroups bookmarks={[bookmarks[0]!]} sections={['Daily']} />,
    )
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

  it('suppresses favicon requests for a bookmark ID outside the safe route shape', () => {
    const unsafe = { ...bookmarks[0]!, id: '../private' }
    const { container } = render(<BookmarkGroups bookmarks={[unsafe]} sections={['Daily']} />)

    expect(container.querySelector('.bookmark-favicon')).not.toBeInTheDocument()
    expect(container.querySelector('.bookmark-fallback')).toBeInTheDocument()
  })

  it('uses one anchor activation area for icon, label, and target padding', () => {
    const { container } = render(
      <BookmarkGroups bookmarks={[bookmarks[0]!]} sections={['Daily']} />,
    )
    const link = screen.getByRole('link', { name: 'Gmail — personal inbox' })
    const activated = vi.fn((event: Event) => event.preventDefault())
    link.addEventListener('click', activated)
    fireEvent.click(container.querySelector('.bookmark-mark')!)
    fireEvent.click(container.querySelector('.bookmark-name')!)
    fireEvent.click(link)
    expect(activated).toHaveBeenCalledTimes(3)
  })

  it.each([false, true])(
    'renders named empty sections in saved order in the %s renderer',
    (dense) => {
      render(
        <BookmarkGroups
          dense={dense}
          bookmarks={bookmarks.filter((bookmark) => bookmark.group === 'Daily')}
          sections={['Empty first', 'Daily', 'Empty last']}
        />,
      )

      expect(
        screen.getAllByRole('navigation').map((item) => item.getAttribute('aria-label')),
      ).toEqual(['Empty first bookmarks', 'Daily bookmarks', 'Empty last bookmarks'])
      expect(screen.getAllByText('No bookmarks')).toHaveLength(2)
      expect(screen.getByRole('heading', { name: 'Empty first' })).toBeVisible()
      expect(screen.getByRole('heading', { name: 'Empty last' })).toBeVisible()
    },
  )

  it('distinguishes a document with zero sections from named empty sections', () => {
    const { rerender } = render(<BookmarkGroups bookmarks={[]} sections={[]} />)
    expect(screen.getByText('No valid bookmarks are configured.')).toBeVisible()
    expect(screen.queryByText('No bookmarks')).toBeNull()

    rerender(<BookmarkGroups bookmarks={[]} sections={['Reading']} />)
    expect(screen.queryByText('No valid bookmarks are configured.')).toBeNull()
    expect(screen.getByRole('heading', { name: 'Reading' })).toBeVisible()
    expect(screen.getByText('No bookmarks')).toBeVisible()
  })
})
