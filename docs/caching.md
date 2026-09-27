# Caching

Source: https://nextjs.org/docs/app/getting-started/caching

> This page covers caching with Cache Components, enabled by setting `cacheComponents: true` in your `next.config.ts` file.

Caching is a technique for storing the result of data fetching and other computations so that future requests for the same data can be served faster, without doing the work again.

## Enabling Cache Components

```ts filename="next.config.ts"
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  cacheComponents: true,
}

export default nextConfig
```

## Usage

The `use cache` directive caches the return value of async functions and components. You can apply it at two levels:

* **Data-level**: Cache a function that fetches or computes data (e.g., `getProducts()`, `getUser(id)`)
* **UI-level**: Cache an entire component or page (e.g., `async function BlogPosts()`)

> **Good to know:** We recommend pairing every cache directive with a `cacheLife`. Without one, the implicit `default` profile applies.

### Data-level caching

```tsx filename="app/lib/data.ts"
import { cacheLife } from 'next/cache'

export async function getUsers() {
  'use cache'
  cacheLife('hours')
  return db.query('SELECT * FROM users')
}
```

### UI-level caching

```tsx filename="app/page.tsx"
import { cacheLife } from 'next/cache'

export default async function Page() {
  'use cache'
  cacheLife('hours')

  const users = await db.query('SELECT * FROM users')

  return (
    <ul>
      {users.map((user) => (
        <li key={user.id}>{user.name}</li>
      ))}
    </ul>
  )
}
```

> If you add "`use cache`" at the top of a file, all exported functions in the file will be cached.

### Streaming uncached data

For components that fetch data from an asynchronous source such as an API, a database, or any other async operation, and require fresh data on every request, do not use `"use cache"`.

Instead, wrap the component in `<Suspense>` and provide a fallback UI. The fallback ships with the prerendered shell while the async work runs at request time.

```tsx filename="page.tsx"
import { Suspense } from 'react'

async function LatestPosts() {
  const data = await fetch('https://api.example.com/posts')
  const posts = await data.json()
  return (
    <ul>
      {posts.map((post) => (
        <li key={post.id}>{post.title}</li>
      ))}
    </ul>
  )
}

export default function Page() {
  return (
    <>
      <h1>My Blog</h1>
      <Suspense fallback={<p>Loading posts...</p>}>
        <LatestPosts />
      </Suspense>
    </>
  )
}
```

`<Suspense>` provides a fallback UI while async work completes, but it does not itself opt a component into dynamic rendering. If a component only performs synchronous work, it will complete during prerendering regardless of whether it is wrapped in `<Suspense>`.

## Working with runtime APIs

Runtime APIs require information that is only available when a user makes a request. These include `cookies`, `headers`, `searchParams`, and `params`.

Components that access runtime APIs should be wrapped in `<Suspense>`:

```tsx filename="page.tsx"
import { cookies } from 'next/headers'
import { Suspense } from 'react'

async function UserGreeting() {
  const cookieStore = await cookies()
  const theme = cookieStore.get('theme')?.value || 'light'
  return <p>Your theme: {theme}</p>
}

export default function Page() {
  return (
    <>
      <h1>Dashboard</h1>
      <Suspense fallback={<p>Loading...</p>}>
        <UserGreeting />
      </Suspense>
    </>
  )
}
```

Runtime-dependent data can still be given a cache lifetime with `"use cache: private"`, another variant that ships with Cache Components. It gives a lifetime to a function that reads cookies, headers, or `searchParams` directly, so it can be included in a prefetch.

### Passing runtime values to cached functions

You can extract values from runtime APIs and pass them as arguments to cached functions:

```tsx filename="app/profile/page.tsx"
import { cookies } from 'next/headers'
import { Suspense } from 'react'

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ProfileContent />
    </Suspense>
  )
}

async function ProfileContent() {
  const session = (await cookies()).get('session')?.value
  return <CachedContent sessionId={session} />
}

async function CachedContent({ sessionId }: { sessionId: string }) {
  'use cache'
  const data = await fetchUserData(sessionId)
  return <div>{data}</div>
}
```

## Random values and timestamps

Operations like `Math.random()`, `Date.now()`, or `crypto.randomUUID()` produce different values each time they execute. Cache Components requires you to explicitly handle these.

**To generate unique values per request**, defer to request time by calling `connection()` before these operations, and wrap the component in `<Suspense>`:

```tsx filename="page.tsx"
import { connection } from 'next/server'
import { Suspense } from 'react'

async function UniqueContent() {
  await connection()
  const uuid = crypto.randomUUID()
  return <p>Request ID: {uuid}</p>
}

export default function Page() {
  return (
    <Suspense fallback={<p>Loading...</p>}>
      <UniqueContent />
    </Suspense>
  )
}
```

Alternatively, you can **cache the result** so all users see the same value until revalidation.

## Predictable values

Unlike random values and timestamps, module imports, synchronous I/O, and pure computations produce the same result every time they run. Components using only these operations are prerendered automatically, and their output becomes part of the static HTML at build time.

## Prerendering

At build time, Next.js renders your route's component tree. How each component is handled depends on the APIs it uses: `use cache` results are cached and included in the static shell; `<Suspense>` fallback UI is included in the static shell while content streams at request time; predictable values complete during prerender; random values and timestamps need `connection()` + `<Suspense>` or `use cache`.

This generates a static shell consisting of HTML for initial page loads and a serialized RSC Payload for client-side navigation. This rendering approach is called **Partial Prerendering (PPR)**, the default behavior with Cache Components.

Every produced static shell can be served directly from a CDN, without going through to the upstream server. This makes direct navigations instant.

### Maximizing the static shell

The deeper your async work sits in the tree, the more of the page can be prerendered. Instead of awaiting a runtime value like `params` at the layout level, pass the params promise down and await it inside a `<Suspense>` boundary further down the tree, so the rest of the layout can still be prerendered.

### Prefetching

With Partial Prefetching enabled, the router prefetches each route's App Shell by default. To also prefetch cached content that depends on a link's URL data, such as `searchParams` or dynamic `params`, set `prefetch={true}` on that link.

## Where cached content is stored

A cached function's output is serialized into an RSC payload, at build time or at runtime:

* **Prerendered HTML** — stored on disk when self-hosting, or in your platform's durable storage behind a CDN.
* **Shared store** — by default an in-memory, per-instance store that is ephemeral on serverless. `use cache: remote` moves it to a durable cache handler shared across instances.
* **Browser** — the payload is included in the RSC sent for a client navigation or prefetch. `use cache: private` results live only here.

## Incremental Static Regeneration

In a route with dynamic param segments, `generateStaticParams` prerenders the URLs you list at build time. Any other URL is served the App Shell instantly, then upgraded in the background with its now-known params and cached for the next visitor.

## Bots and crawlers

Browsers receive the static shell instantly. Bots and crawlers are detected by their user agent and handled differently: because they need a complete document, Next.js skips the shell and renders the entire page dynamically at request time, then sends the finished HTML once the render completes.
