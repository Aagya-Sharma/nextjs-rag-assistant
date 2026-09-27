# Metadata and OG images

Source: https://nextjs.org/docs/app/getting-started/metadata-and-og-images

The Metadata APIs can be used to define your application metadata for improved SEO and web shareability and include the static `metadata` object, the dynamic `generateMetadata` function, and special file conventions that can be used to add static or dynamically generated favicons and OG images.

The `metadata` object and `generateMetadata` function exports are only supported in Server Components.

## Default fields

There are two default `meta` tags that are always added even if a route doesn't define metadata: the meta charset tag and the meta viewport tag.

```html
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
```

## Static metadata

To define static metadata, export a `Metadata` object from a static `layout.js` or `page.js` file. For example, to add a title and description to the blog route:

```tsx filename="app/blog/layout.tsx"
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'My Blog',
  description: '...',
}

export default function Layout() {}
```

## Generated metadata

You can use `generateMetadata` function to `fetch` metadata that depends on data. For example, to fetch the title and description for a specific blog post:

```tsx filename="app/blog/[slug]/page.tsx"
import type { Metadata, ResolvingMetadata } from 'next'

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export async function generateMetadata(
  { params, searchParams }: Props,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const slug = (await params).slug

  const post = await fetch(`https://api.vercel.app/blog/${slug}`).then((res) =>
    res.json()
  )

  return {
    title: post.title,
    description: post.description,
  }
}

export default function Page({ params, searchParams }: Props) {}
```

### Streaming metadata

For dynamically rendered pages, Next.js streams metadata separately, injecting it into the HTML once `generateMetadata` resolves, without blocking UI rendering.

Streaming metadata is **disabled for bots and crawlers** that expect metadata to be in the `<head>` tag (e.g. Twitterbot, Slackbot, Bingbot). These are detected by using the User Agent header from the incoming request.

Prerendered pages don't use streaming since metadata is resolved at build time.

### Memoizing data requests

There may be cases where you need to fetch the **same** data for metadata and the page itself. To avoid duplicate requests, you can use React's `cache` function to memoize the return value and only fetch the data once.

```ts filename="app/lib/data.ts"
import { cache } from 'react'
import { db } from '@/app/lib/db'

export const getPost = cache(async (slug: string) => {
  const res = await db.query.posts.findFirst({ where: eq(posts.slug, slug) })
  return res
})
```

## File-based metadata

The following special files are available for metadata: `favicon.ico`, `apple-icon.jpg`, `icon.jpg`, `opengraph-image.jpg`, `twitter-image.jpg`, `robots.txt`, and `sitemap.xml`. You can use these for static metadata, or you can programmatically generate these files with code.

## Favicons

To add a favicon to your application, create a `favicon.ico` and add to the root of the app folder.

## Static Open Graph images

To add a static OG image to your application, create an `opengraph-image.jpg` file in the root of the app folder. You can also add OG images for specific routes by creating an `opengraph-image.jpg` deeper down the folder structure. The more specific image will take precedence over any OG images above it in the folder structure.

## Generated Open Graph images

The `ImageResponse` constructor allows you to generate dynamic images using JSX and CSS. This is useful for OG images that depend on data.

```tsx filename="app/blog/[slug]/opengraph-image.tsx"
import { ImageResponse } from 'next/og'
import { getPost } from '@/app/lib/data'

export const size = {
  width: 1200,
  height: 630,
}

export const contentType = 'image/png'

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const post = await getPost(slug)

  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 128,
          background: 'white',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {post.title}
      </div>
    )
  )
}
```

> **Good to know**:
>
> * `ImageResponse` uses `@vercel/og`, `satori`, and `resvg` to convert HTML and CSS into PNG.
> * Only flexbox and a subset of CSS properties are supported. Advanced layouts (e.g. `display: grid`) will not work.
