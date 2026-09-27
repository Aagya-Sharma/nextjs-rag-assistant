# Linking and Navigating

Source: https://nextjs.org/docs/app/getting-started/linking-and-navigating

In Next.js, routes are rendered on the server by default. This often means the client has to wait for a server response before a new route can be shown. Next.js comes with built-in prefetching, streaming, and client-side transitions ensuring navigation stays fast and responsive.

## How navigation works

### Server Rendering

In Next.js, Layouts and Pages are React Server Components by default. On initial and subsequent navigations, the Server Component Payload is generated on the server before being sent to the client.

There are two types of server rendering, based on *when* it happens:

* **Prerendering** happens at build time or during revalidation and the result is cached.
* **Dynamic Rendering** happens at request time in response to a client request.

### Prefetching

Prefetching is the process of loading a route in the background before the user navigates to it. This makes navigation between routes in your application feel instant, because by the time a user clicks on a link, the data to render the next route is already available client side.

Next.js automatically prefetches routes linked with the `<Link>` component when they enter the user's viewport.

```tsx filename="app/layout.tsx"
import Link from 'next/link'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <nav>
          {/* Prefetched when the link is hovered or enters the viewport */}
          <Link href="/blog">Blog</Link>
          {/* No prefetching */}
          <a href="/contact">Contact</a>
        </nav>
        {children}
      </body>
    </html>
  )
}
```

How much of the route is prefetched depends on whether it's static or dynamic:

* **Static Route**: the full route is prefetched.
* **Dynamic Route**: prefetching is skipped, or the route is partially prefetched if `loading.tsx` is present.

### Streaming

Streaming allows the server to send parts of a dynamic route to the client as soon as they're ready, rather than waiting for the entire route to be rendered. This means users see something sooner, even if parts of the page are still loading.

To use streaming, create a `loading.tsx` in your route folder. Behind the scenes, Next.js will automatically wrap the `page.tsx` contents in a `<Suspense>` boundary.

Benefits of `loading.tsx`:

* Immediate navigation and visual feedback for the user.
* Shared layouts remain interactive and navigation is interruptible.
* Improved Core Web Vitals: TTFB, FCP, and TTI.

### Client-side transitions

Traditionally, navigation to a server-rendered page triggers a full page load. This clears state, resets scroll position, and blocks interactivity.

Next.js avoids this with client-side transitions using the `<Link>` component. Instead of reloading the page, it updates the content dynamically by keeping any shared layouts and UI, and replacing the current page with the prefetched loading state or a new page if available.

## What can make transitions slow?

### Dynamic routes without `loading.tsx`

When navigating to a dynamic route, the client must wait for the server response before showing the result. We recommend adding `loading.tsx` to dynamic routes to enable partial prefetching, trigger immediate navigation, and display a loading UI while the route renders.

### Dynamic segments without `generateStaticParams`

If a dynamic segment could be prerendered but isn't because it's missing `generateStaticParams`, the route will fallback to dynamic rendering at request time.

### Slow networks

On slow or unstable networks, prefetching may not finish before the user clicks a link. To improve perceived performance, you can use the `useLinkStatus` hook to show immediate feedback while the transition is in progress.

```tsx filename="app/ui/loading-indicator.tsx"
'use client'

import { useLinkStatus } from 'next/link'

export default function LoadingIndicator() {
  const { pending } = useLinkStatus()
  return (
    <span aria-hidden className={`link-hint ${pending ? 'is-pending' : ''}`} />
  )
}
```

### Disabling prefetching

You can opt out of prefetching by setting the `prefetch` prop to `false` on the `<Link>` component. This is useful to avoid unnecessary usage of resources when rendering large lists of links (e.g. an infinite scroll table).

```tsx
<Link prefetch={false} href="/blog">
  Blog
</Link>
```

To reduce resource usage without fully disabling prefetch, you can prefetch only on hover:

```tsx filename="app/ui/hover-prefetch-link.tsx"
'use client'

import Link from 'next/link'
import { useState } from 'react'

function HoverPrefetchLink({
  href,
  children,
}: {
  href: string
  children: React.ReactNode
}) {
  const [active, setActive] = useState(false)

  return (
    <Link
      href={href}
      prefetch={active ? null : false}
      onMouseEnter={() => setActive(true)}
    >
      {children}
    </Link>
  )
}
```

### Hydration not completed

`<Link>` is a Client Component and must be hydrated before it can prefetch routes. On the initial visit, large JavaScript bundles can delay hydration, preventing prefetching from starting right away.

## Examples

### Native History API

Next.js allows you to use the native `window.history.pushState` and `window.history.replaceState` methods to update the browser's history stack without reloading the page. They integrate into the Next.js Router, allowing you to sync with `usePathname` and `useSearchParams`.

```tsx filename="app/ui/sort-products.tsx"
'use client'

import { useSearchParams } from 'next/navigation'

export default function SortProducts() {
  const searchParams = useSearchParams()

  function updateSorting(sortOrder: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('sort', sortOrder)
    window.history.pushState(null, '', `?${params.toString()}`)
  }

  return (
    <>
      <button onClick={() => updateSorting('asc')}>Sort Ascending</button>
      <button onClick={() => updateSorting('desc')}>Sort Descending</button>
    </>
  )
}
```
