# Revalidating

Source: https://nextjs.org/docs/app/getting-started/revalidating

Revalidation is the process of updating cached data. It lets you keep serving fast, cached responses while ensuring content stays fresh. There are two strategies:

* **Time-based revalidation**: Automatically refresh cached data after a set duration using `cacheLife`.
* **On-demand revalidation**: Manually invalidate cached data after a mutation using `revalidateTag`, `updateTag`, or `revalidatePath`.

## `cacheLife`

`cacheLife` controls how long cached data remains valid. Use it inside a `use cache` scope to set the cache lifetime.

```tsx filename="app/lib/data.ts"
import { cacheLife } from 'next/cache'

export async function getProducts() {
  'use cache'
  cacheLife('hours')
  return db.query('SELECT * FROM products')
}
```

`cacheLife` accepts a profile name or a custom configuration object:

| Profile   | `stale` | `revalidate` | `expire` |
| --------- | ------- | ------------ | -------- |
| `default` | 5m      | 15m          | never    |
| `seconds` | 30s     | 1s           | 60s      |
| `minutes` | 5m      | 1m           | 1h       |
| `hours`   | 5m      | 1h           | 1d       |
| `days`    | 5m      | 1d           | 1w       |
| `weeks`   | 5m      | 1w           | 30d      |
| `max`     | 5m      | 30d          | 1y       |

For fine-grained control, pass an object:

```tsx
'use cache'
cacheLife({
  stale: 3600, // 1 hour until considered stale
  revalidate: 7200, // 2 hours until revalidated
  expire: 86400, // 1 day until expired
})
```

> **Good to know:** A cache is considered "short-lived" when it uses the `seconds` profile, `revalidate: 0`, or `expire` under 5 minutes. Short-lived caches are automatically excluded from prerenders and become dynamic holes instead.

## `cacheTag`

`cacheTag` lets you tag cached data so it can be invalidated on-demand. Use it inside a `use cache` scope:

```tsx filename="app/lib/data.ts"
import { cacheTag } from 'next/cache'

export async function getProducts() {
  'use cache'
  cacheTag('products')
  return db.query('SELECT * FROM products')
}
```

Once tagged, invalidate the cache using `revalidateTag` or `updateTag`.

## `revalidateTag`

`revalidateTag` invalidates cache entries by tag using stale-while-revalidate semantics — stale content is served immediately while fresh content loads in the background. This is ideal for content where a slight delay in updates is acceptable, like blog posts or product catalogs.

```tsx filename="app/lib/actions.ts"
import { revalidateTag } from 'next/cache'

export async function updateUser(id: string) {
  // Mutate data
  revalidateTag('user', 'max') // Recommended: stale-while-revalidate
}
```

You can reuse the same tag in multiple functions to revalidate them all at once. Call `revalidateTag` in a Server Action or Route Handler.

> **Good to know:** The second argument sets how long stale content can be served while fresh content generates in the background. Once it expires, subsequent requests block until fresh content is ready. Using `'max'` gives the longest stale window.

## `updateTag`

`updateTag` immediately expires cached data for read-your-own-writes scenarios — the user sees their change right away instead of stale content. Unlike `revalidateTag`, it can only be used in Server Actions.

```tsx filename="app/lib/actions.ts"
import { updateTag } from 'next/cache'
import { redirect } from 'next/navigation'

export async function createPost(formData: FormData) {
  const post = await db.post.create({
    data: {
      title: formData.get('title'),
      content: formData.get('content'),
    },
  })

  updateTag('posts')
  redirect(`/posts/${post.id}`)
}
```

|              | `updateTag`                                   | `revalidateTag`                      |
| ------------ | --------------------------------------------- | ------------------------------------ |
| **Where**    | Server Actions only                           | Server Actions and Route Handlers    |
| **Behavior** | Immediately expires cache                     | Stale-while-revalidate               |
| **Use case** | Read-your-own-writes (user sees their change) | Background refresh (slight delay OK) |

## `revalidatePath`

`revalidatePath` invalidates all cached data for a specific route path. Use it when you want to revalidate a route without knowing which tags are associated with it.

```tsx filename="app/lib/actions.ts"
import { revalidatePath } from 'next/cache'

export async function updateUser(id: string) {
  // Mutate data
  revalidatePath('/profile')
}
```

> **Good to know**: Prefer tag-based revalidation (`revalidateTag`/`updateTag`) over path-based when possible — it's more precise and avoids over-invalidating.

## What should I cache?

Cache data that doesn't depend on runtime data and that you're OK serving from cache for a period of time. Use `use cache` with `cacheLife` to describe that behavior.

When content doesn't need time-based revalidation, for example data from a CMS, use `cacheTag` and a long `cacheLife` like `max` to keep it in the static shell. Configure the content source to trigger a webhook that calls `revalidateTag` when the content changes.
