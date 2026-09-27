# Dynamic Route Segments

Source: https://nextjs.org/docs/app/api-reference/file-conventions/dynamic-routes

A URL path is a sequence of path segments. In the App Router, a segment may be **static** (a literal value matched exactly) or **dynamic** (a placeholder that captures a value from the URL). When you don't know a segment's value ahead of time, define a Dynamic Segment to create routes from dynamic data. Next.js passes the captured values to your page via the path `params` prop, either filled in at request time or prerendered at build time.

> **Good to know**: Dynamic Segments are often referred to as path params, route params, or URL params.

## Convention

A Dynamic Segment can be created by wrapping a folder's name in square brackets: `[folderName]`. For example, a blog could include the following route `app/blog/[slug]/page.js` where `[slug]` is the Dynamic Segment for blog posts.

```tsx filename="app/blog/[slug]/page.tsx"
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  return <div>My Post: {slug}</div>
}
```

Dynamic Segments are passed as the `params` prop to `layout`, `page`, `route`, and `generateMetadata` functions.

| Route                     | Example URL | `params`        |
| ------------------------- | ----------- | --------------- |
| `app/blog/[slug]/page.js` | `/blog/a`   | `{ slug: 'a' }` |
| `app/blog/[slug]/page.js` | `/blog/b`   | `{ slug: 'b' }` |
| `app/blog/[slug]/page.js` | `/blog/c`   | `{ slug: 'c' }` |

### In Client Components

In a Client Component **page**, dynamic segments from props can be accessed using the `use` API.

```tsx filename="app/blog/[slug]/page.tsx"
'use client'
import { use } from 'react'

export default function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = use(params)

  return (
    <div>
      <p>{slug}</p>
    </div>
  )
}
```

Alternatively Client Components can use the `useParams` hook to access the `params` anywhere in the Client Component tree.

### Catch-all Segments

Dynamic Segments can be extended to **catch-all** subsequent segments by adding an ellipsis inside the brackets `[...folderName]`.

For example, `app/shop/[...slug]/page.js` will match `/shop/clothes`, but also `/shop/clothes/tops`, `/shop/clothes/tops/t-shirts`, and so on.

| Route                        | Example URL   | `params`                    |
| ----------------------------- | ------------- | ---------------------------- |
| `app/shop/[...slug]/page.js` | `/shop/a`     | `{ slug: ['a'] }`            |
| `app/shop/[...slug]/page.js` | `/shop/a/b`   | `{ slug: ['a', 'b'] }`       |
| `app/shop/[...slug]/page.js` | `/shop/a/b/c` | `{ slug: ['a', 'b', 'c'] }`  |

### Optional Catch-all Segments

Catch-all Segments can be made **optional** by including the parameter in double square brackets: `[[...folderName]]`.

For example, `app/shop/[[...slug]]/page.js` will **also** match `/shop`, in addition to `/shop/clothes`, `/shop/clothes/tops`, `/shop/clothes/tops/t-shirts`.

The difference between **catch-all** and **optional catch-all** segments is that with optional, the route without the parameter is also matched (`/shop` in the example above).

### TypeScript

When using TypeScript, you can add types for `params` depending on your configured route segment — use `PageProps<'/route'>`, `LayoutProps<'/route'>`, or `RouteContext<'/route'>` to type `params` in `page`, `layout`, and `route` respectively.

Route `params` values are typed as `string`, `string[]`, or `undefined` (for optional catch-all segments), because their values aren't known until runtime.

| Route                               | `params` Type Definition                 |
| ------------------------------------ | ------------------------------------------ |
| `app/blog/[slug]/page.js`           | `{ slug: string }`                       |
| `app/shop/[...slug]/page.js`        | `{ slug: string[] }`                     |
| `app/shop/[[...slug]]/page.js`      | `{ slug?: string[] }`                    |
| `app/[categoryId]/[itemId]/page.js` | `{ categoryId: string, itemId: string }` |

## Behavior

* Since the `params` prop is a promise, you must use `async`/`await` or React's `use` function to access the values.

## Examples

### With `generateStaticParams`

The `generateStaticParams` function can be used to statically generate routes at build time instead of on-demand at request time.

```tsx filename="app/blog/[slug]/page.tsx"
export async function generateStaticParams() {
  const posts = await fetch('https://.../posts').then((res) => res.json())

  return posts.map((post) => ({
    slug: post.slug,
  }))
}
```

When using `fetch` inside the `generateStaticParams` function, the requests are automatically deduplicated. This avoids multiple network calls for the same data across Layouts, Pages, and other `generateStaticParams` functions, speeding up build time.

### Dynamic GET Route Handlers with `generateStaticParams`

`generateStaticParams` also works with dynamic Route Handlers to statically generate API responses at build time:

```ts filename="app/api/posts/[id]/route.ts"
export async function generateStaticParams() {
  const posts: { id: number }[] = await fetch(
    'https://api.vercel.app/blog'
  ).then((res) => res.json())

  return posts.map((post) => ({
    id: `${post.id}`,
  }))
}

export async function GET(
  request: Request,
  { params }: RouteContext<'/api/posts/[id]'>
) {
  const { id } = await params
  const res = await fetch(`https://api.vercel.app/blog/${id}`)

  if (!res.ok) {
    return Response.json({ error: 'Post not found' }, { status: 404 })
  }

  const post = await res.json()
  return Response.json(post)
}
```

In this example, route handlers for all blog post IDs returned by `generateStaticParams` will be statically generated at build time. Requests to other IDs will be handled dynamically at request time.
