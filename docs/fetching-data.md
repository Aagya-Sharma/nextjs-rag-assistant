# Fetching Data

Source: https://nextjs.org/docs/app/getting-started/fetching-data

This page will walk you through how you can fetch data in Server and Client Components, and how to stream components that depend on uncached data.

## Fetching data

### Server Components

You can fetch data in Server Components using any asynchronous I/O, such as the `fetch` API, or an ORM/database.

#### With the `fetch` API

To fetch data with the `fetch` API, turn your component into an asynchronous function, and await the `fetch` call. For example:

```tsx filename="app/blog/page.tsx"
export default async function Page() {
  const data = await fetch('https://api.vercel.app/blog')
  const posts = await data.json()
  return (
    <ul>
      {posts.map((post) => (
        <li key={post.id}>{post.title}</li>
      ))}
    </ul>
  )
}
```

> **Good to know:**
>
> * Identical `fetch` requests in a React component tree are memoized by default, so you can fetch data in the component that needs it instead of drilling props.
> * `fetch` requests are not cached by default and will block the page from rendering until the request is complete. Use the `use cache` directive to cache results, or wrap the fetching component in `<Suspense>` to stream fresh data at request time.

#### With an ORM or database

Since Server Components are rendered on the server, credentials and query logic will not be included in the client bundle so you can safely make database queries using an ORM or database client.

```tsx filename="app/blog/page.tsx"
import { db, posts } from '@/lib/db'

export default async function Page() {
  const allPosts = await db.select().from(posts)
  return (
    <ul>
      {allPosts.map((post) => (
        <li key={post.id}>{post.title}</li>
      ))}
    </ul>
  )
}
```

### Streaming

When you fetch data in Server Components, the data is fetched and rendered on the server for each request. If you have any slow data requests, the whole route will be blocked from rendering until all the data is fetched.

To improve the initial load time and user experience, you can break the page into smaller *chunks* and progressively send those chunks from the server to the client. This is called streaming.

There are two ways you can use streaming in your application:

1. Wrapping a page with a `loading.js` file
2. Wrapping a component with `<Suspense>`

> **Good to know:** Bots and crawlers are served differently from browsers. Next.js waits for data fetching to finish and sends the fully rendered page instead of streaming it progressively.

#### With `loading.js`

You can create a `loading.js` file in the same folder as your page to stream the **entire page** while the data is being fetched.

```tsx filename="app/blog/loading.tsx"
export default function Loading() {
  return <div>Loading...</div>
}
```

On navigation, the user will immediately see the layout and a loading state while the page is being rendered. The new content will then be automatically swapped in once rendering is complete.

Behind the scenes, `loading.js` will be nested inside `layout.js`, and will automatically wrap the `page.js` file and any children below in a `<Suspense>` boundary.

#### With `<Suspense>`

`<Suspense>` allows you to be more granular about what parts of the page to stream. For example, you can immediately show any page content that falls outside of the `<Suspense>` boundary, and stream in the list of blog posts inside the boundary.

```tsx filename="app/blog/page.tsx"
import { Suspense } from 'react'
import BlogList from '@/components/BlogList'
import BlogListSkeleton from '@/components/BlogListSkeleton'

export default function BlogPage() {
  return (
    <div>
      <header>
        <h1>Welcome to the Blog</h1>
        <p>Read the latest posts below.</p>
      </header>
      <main>
        <Suspense fallback={<BlogListSkeleton />}>
          <BlogList />
        </Suspense>
      </main>
    </div>
  )
}
```

### Client Components

There are two ways to fetch data in Client Components, using React's `use` API, or a community library like SWR or React Query.

#### Streaming data with the `use` API

You can use React's `use` API to stream data from the server to client. Start by fetching data in your Server component, and pass the promise to your Client Component as prop:

```tsx filename="app/blog/page.tsx"
import Posts from '@/app/ui/posts'
import { Suspense } from 'react'

export default function Page() {
  const posts = getPosts()

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Posts posts={posts} />
    </Suspense>
  )
}
```

Then, in your Client Component, use the `use` API to read the promise:

```tsx filename="app/ui/posts.tsx"
'use client'
import { use } from 'react'

export default function Posts({
  posts,
}: {
  posts: Promise<{ id: string; title: string }[]>
}) {
  const allPosts = use(posts)

  return (
    <ul>
      {allPosts.map((post) => (
        <li key={post.id}>{post.title}</li>
      ))}
    </ul>
  )
}
```

#### Community libraries

You can use a community library like SWR or React Query to fetch data in Client Components.

```tsx filename="app/blog/page.tsx"
'use client'
import useSWR from 'swr'

const fetcher = (url) => fetch(url).then((r) => r.json())

export default function BlogPage() {
  const { data, error, isLoading } = useSWR(
    'https://api.vercel.app/blog',
    fetcher
  )

  if (isLoading) return <div>Loading...</div>
  if (error) return <div>Error: {error.message}</div>

  return (
    <ul>
      {data.map((post: { id: string; title: string }) => (
        <li key={post.id}>{post.title}</li>
      ))}
    </ul>
  )
}
```

## Examples

### Sequential data fetching

Sequential data fetching happens when one request depends on data from another.

```tsx filename="app/artist/[username]/page.tsx"
export default async function Page({
  params,
}: {
  params: Promise<{ username: string }>
}) {
  const { username } = await params
  const artist = await getArtist(username)

  return (
    <>
      <h1>{artist.name}</h1>
      <Suspense fallback={<div>Loading...</div>}>
        <Playlists artistID={artist.id} />
      </Suspense>
    </>
  )
}

async function Playlists({ artistID }: { artistID: string }) {
  const playlists = await getArtistPlaylists(artistID)

  return (
    <ul>
      {playlists.map((playlist) => (
        <li key={playlist.id}>{playlist.name}</li>
      ))}
    </ul>
  )
}
```

Ensure your data source can resolve the first request quickly, as it blocks everything else.

### Parallel data fetching

Parallel data fetching happens when data requests in a route are eagerly initiated and start at the same time.

By default, layouts and pages are rendered in parallel. So each segment starts fetching data as soon as possible.

However, within *any* component, multiple `async`/`await` requests can still be sequential if placed after the other.

Start multiple requests by calling `fetch`, then await them with `Promise.all`. Requests begin as soon as `fetch` is called.

```tsx filename="app/artist/[username]/page.tsx"
async function getArtist(username: string) {
  const res = await fetch(`https://api.example.com/artist/${username}`)
  return res.json()
}

async function getAlbums(username: string) {
  const res = await fetch(`https://api.example.com/artist/${username}/albums`)
  return res.json()
}

export default async function Page({
  params,
}: {
  params: Promise<{ username: string }>
}) {
  const { username } = await params

  const artistData = getArtist(username)
  const albumsData = getAlbums(username)

  const [artist, albums] = await Promise.all([artistData, albumsData])

  return (
    <>
      <h1>{artist.name}</h1>
      <Albums list={albums} />
    </>
  )
}
```

> **Good to know:** If one request fails when using `Promise.all`, the entire operation will fail. To handle this, you can use the `Promise.allSettled` method instead.

### Reusing data with `React.cache`

For data access that does not use `fetch`, such as an ORM or database query, wrap the function in `React.cache`. Multiple components can then call the function within the same request while sharing one result:

```ts filename="app/lib/user.ts"
import { cache } from 'react'
import { db, eq, users } from '@/lib/db'

export const getUser = cache(async (id: string) => {
  return db.query.users.findFirst({
    where: eq(users.id, id),
  })
})
```

> **Good to know:** `React.cache` is scoped to the current request only. Each request gets its own memoization scope with no sharing between requests.

### Preloading data

When a component renders after other blocking work, its data request starts late even if the request inputs are already available. Preloading starts the request earlier so it can run in parallel with that work and avoid a request waterfall.

To preload data, call the data-fetching function without `await` before blocking work, then call the same function in the component that consumes the result.

```tsx filename="app/item/[id]/item.tsx"
async function getItem(id: string) {
  const res = await fetch(`https://api.example.com/items/${id}`)
  return res.json()
}

export const preload = (id: string) => {
  void getItem(id)
}

export default async function Item({ id }: { id: string }) {
  const item = await getItem(id)
  return <div>{item.name}</div>
}
```

Call `preload()` before another blocking request to start loading the item earlier:

```tsx filename="app/item/[id]/page.tsx"
import Item, { preload } from './item'
import { checkIsAvailable } from '@/app/lib/data'

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  preload(id)
  const isAvailable = await checkIsAvailable(id)

  return isAvailable ? <Item id={id} /> : null
}
```
