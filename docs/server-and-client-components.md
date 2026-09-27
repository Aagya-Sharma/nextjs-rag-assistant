# Server and Client Components

Source: https://nextjs.org/docs/app/getting-started/server-and-client-components

By default, layouts and pages are Server Components, which lets you fetch data and render parts of your UI on the server, optionally cache the result, and stream it to the client. When you need interactivity or browser APIs, you can use Client Components to layer in functionality.

## When to use Server and Client Components?

The client and server environments have different capabilities. Server and Client Components allow you to run logic in each environment depending on your use case.

Use **Client Components** when you need:

* State and event handlers. E.g. `onClick`, `onChange`.
* Lifecycle logic. E.g. `useEffect`.
* Browser-only APIs. E.g. `localStorage`, `window`, `navigator.geolocation`, etc.
* Custom hooks.

Use **Server Components** when you need:

* Fetch data from databases or APIs close to the source.
* Use API keys, tokens, and other secrets without exposing them to the client.
* Reduce the amount of JavaScript sent to the browser.
* Improve the First Contentful Paint (FCP), and stream content progressively to the client.

For example, the `<Page>` component is a Server Component that fetches data about a post, and passes it as props to the `<LikeButton>` which handles client-side interactivity.

```tsx filename="app/[id]/page.tsx"
import LikeButton from '@/app/ui/like-button'
import { getPost } from '@/lib/data'

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const post = await getPost(id)

  return (
    <div>
      <main>
        <h1>{post.title}</h1>
        <LikeButton likes={post.likes} />
      </main>
    </div>
  )
}
```

```tsx filename="app/ui/like-button.tsx"
'use client'

import { useState } from 'react'

export default function LikeButton({ likes }: { likes: number }) {
  // ...
}
```

## How do Server and Client Components work in Next.js?

### On the server

On the server, Next.js uses React's APIs to orchestrate rendering. The rendering work is split into chunks, by individual route segments (layouts and pages), including parallel route slots whether or not they are displayed:

* **Server Components** are rendered into a special data format called the React Server Component Payload (RSC Payload).
* **Client Components** and the RSC Payload are used to prerender HTML.

> **What is the React Server Component Payload (RSC)?**
>
> The RSC Payload is a compact, serialized representation of the rendered React Server Components tree. It's used by React on the client to update the browser's DOM. The RSC Payload contains:
>
> * The rendered result of Server Components
> * Placeholders for where Client Components should be rendered and references to their JavaScript files
> * Any props passed from a Server Component to a Client Component

### On the client (first load)

Then, on the client:

1. **HTML** is used to immediately show a fast non-interactive preview of the route to the user.
2. **RSC Payload** is used to reconcile the Client and Server Component trees.
3. **JavaScript** is used to hydrate Client Components and make the application interactive.

> **What is hydration?**
>
> Hydration is React's process for attaching event handlers to the DOM, to make the static HTML interactive.

### Subsequent Navigations

On subsequent navigations:

* The **RSC Payload** is prefetched and cached for instant navigation.
* **Client Components** are rendered entirely on the client, without the server-rendered HTML.

## Examples

### Using Client Components

You can create a Client Component by adding the `"use client"` directive at the top of the file, above your imports.

```tsx filename="app/ui/counter.tsx"
'use client'

import { useState } from 'react'

export default function Counter() {
  const [count, setCount] = useState(0)

  return (
    <div>
      <p>{count} likes</p>
      <button onClick={() => setCount(count + 1)}>Click me</button>
    </div>
  )
}
```

`"use client"` is used to declare a **boundary** between the Server and Client module graphs (trees).

Once a file is marked with `"use client"`, **all of its imports and the components it directly renders are included in the client bundle**. This means you don't need to add the directive to every component that is intended for the client.

This behavior applies to components that are part of the Client Component's module graph, which includes the modules it imports and the components it renders directly. It does not apply to Server Components passed as children or other props. Those components are not imported into the Client Component's module graph. They are rendered on the server and passed to the Client Component as rendered output.

### Reducing JS bundle size

To reduce the size of your client JavaScript bundles, add `'use client'` to specific interactive components instead of marking large parts of your UI as Client Components.

For example, the `<Layout>` component contains mostly static elements like a logo and navigation links, but includes an interactive search bar. `<Search />` needs to be a Client Component, while the rest of the layout can stay a Server Component.

```tsx filename="app/layout.tsx"
import Search from './search'
import Logo from './logo'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <nav>
        <Logo />
        <Search />
      </nav>
      <main>{children}</main>
    </>
  )
}
```

### Passing data from Server to Client Components

You can pass data from Server Components to Client Components using props.

> **Good to know**: Props passed to Client Components need to be serializable by React.

Alternatively, you can stream data from a Server Component to a Client Component with the `use` API.

### Interleaving Server and Client Components

You can pass Server Components as a prop to a Client Component. This allows you to visually nest server-rendered UI within Client components.

A common pattern is to use `children` to create a *slot* in a `<ClientComponent>`. For example, a `<Cart>` component that fetches data on the server, inside a `<Modal>` component that uses client state to toggle visibility.

```tsx filename="app/ui/modal.tsx"
'use client'

export default function Modal({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>
}
```

Then, in a parent Server Component (e.g. `<Page>`), you can pass a `<Cart>` as the child of the `<Modal>`:

```tsx filename="app/page.tsx"
import Modal from './ui/modal'
import Cart from './ui/cart'

export default function Page() {
  return (
    <Modal>
      <Cart />
    </Modal>
  )
}
```

In this pattern, Server Components are rendered on the server ahead of time, even when passed as props to Client Components. The React Server Component Payload contains the rendered result of those Server Components, plus placeholders for where Client Components should be rendered and references to their JavaScript files.

### Context providers

React context is commonly used to share global state like the current theme. However, React context is not supported in Server Components.

To use context, create a Client Component that accepts `children`:

```tsx filename="app/theme-provider.tsx"
'use client'

import { createContext } from 'react'

export const ThemeContext = createContext({})

export default function ThemeProvider({
  children,
}: {
  children: React.ReactNode
}) {
  return <ThemeContext.Provider value="dark">{children}</ThemeContext.Provider>
}
```

> **Good to know**: You should render providers as deep as possible in the tree – notice how `ThemeProvider` only wraps `{children}` instead of the entire `<html>` document. This makes it easier for Next.js to optimize the static parts of your Server Components.

### Third-party components

When using a third-party component that relies on client-only features, you can wrap it in a Client Component to ensure it works as expected.

To fix this, you can wrap third-party components that rely on client-only features in your own Client Components:

```tsx filename="app/carousel.tsx"
'use client'

import { Carousel } from 'acme-carousel'

export default Carousel
```

### Preventing environment poisoning

JavaScript modules can be shared between both Server and Client Components modules. This means it's possible to accidentally import server-only code into the client.

In Next.js, only environment variables prefixed with `NEXT_PUBLIC_` are included in the client bundle. If variables are not prefixed, Next.js replaces them with an empty string.

To prevent accidental usage in Client Components, you can use the `server-only` package.

```js filename="lib/data.js"
import 'server-only'

export async function getData() {
  const res = await fetch('https://external-service.com/data', {
    headers: {
      authorization: process.env.API_KEY,
    },
  })

  return res.json()
}
```

Now, if you try to import the module into a Client Component, there will be a build-time error.

The corresponding `client-only` package can be used to mark modules that contain client-only logic like code that accesses the `window` object.
