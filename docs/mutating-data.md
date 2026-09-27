# Mutating Data

Source: https://nextjs.org/docs/app/getting-started/mutating-data

You can mutate data in Next.js using React Server Functions. This page will go through how you can create and invoke Server Functions.

## What are Server Functions?

A **Server Function** is an asynchronous function that runs on the server. You can call them from the client through a network request, which is why they must be asynchronous.

In an `action` or mutation context, they are also called **Server Actions**.

By convention, a Server Action is an async function used with `startTransition`. This happens automatically when the function is:

* Passed to a `<form>` using the `action` prop.
* Passed to a `<button>` using the `formAction` prop.

When an action is invoked, Next.js can return both the updated UI and new data in a single server roundtrip.

Behind the scenes, actions use the `POST` method, and only this HTTP method can invoke them.

> **Warning:** Server Functions are reachable via direct POST requests, not just through your application's UI. Always verify authentication and authorization inside every Server Function.

> **Good to know:** A Server Action is a Server Function used in a specific way (for handling form submissions and mutations). Server Function is the broader term.

## Creating Server Functions

A Server Function can be defined by using the `use server` directive. You can place the directive at the top of an **asynchronous** function to mark the function as a Server Function, or at the top of a separate file to mark all exports of that file.

```ts filename="app/lib/actions.ts"
import { auth } from '@/lib/auth'

export async function createPost(formData: FormData) {
  'use server'
  const session = await auth()
  if (!session?.user) {
    throw new Error('Unauthorized')
  }

  const title = formData.get('title')
  const content = formData.get('content')

  // Mutate data
  // Revalidate cache
}
```

### Server Components

Server Functions can be inlined in Server Components by adding the `"use server"` directive to the top of the function body.

> **Good to know:** Server Components support progressive enhancement by default, meaning forms that call Server Actions will be submitted even if JavaScript hasn't loaded yet or is disabled.

### Client Components

It's not possible to define Server Functions in Client Components. However, you can invoke them in Client Components by importing them from a file that has the `"use server"` directive at the top of it:

```ts filename="app/actions.ts"
'use server'

export async function createPost() {}
```

```tsx filename="app/ui/button.tsx"
'use client'

import { createPost } from '@/app/actions'

export function Button() {
  return <button formAction={createPost}>Create</button>
}
```

> **Good to know:** In Client Components, forms invoking Server Actions will queue submissions if JavaScript isn't loaded yet, and will be prioritized for hydration. After hydration, the browser does not refresh on form submission.

## Invoking Server Functions

There are two main ways you can invoke a Server Function: Forms in Server and Client Components, and Event Handlers / useEffect in Client Components.

> **Good to know:** Server Functions are designed for server-side mutations. The client currently dispatches and awaits them one at a time.

### Forms

React extends the HTML `<form>` element to allow a Server Function to be invoked with the HTML `action` prop.

When invoked in a form, the function automatically receives the `FormData` object.

```tsx filename="app/ui/form.tsx"
import { createPost } from '@/app/actions'

export function Form() {
  return (
    <form action={createPost}>
      <input type="text" name="title" />
      <input type="text" name="content" />
      <button type="submit">Create</button>
    </form>
  )
}
```

```ts filename="app/actions.ts"
'use server'

import { auth } from '@/lib/auth'

export async function createPost(formData: FormData) {
  const session = await auth()
  if (!session?.user) {
    throw new Error('Unauthorized')
  }

  const title = formData.get('title')
  const content = formData.get('content')

  // Mutate data
  // Revalidate cache
}
```

### Event Handlers

You can invoke a Server Function in a Client Component by using event handlers such as `onClick`.

```tsx filename="app/like-button.tsx"
'use client'

import { incrementLike } from './actions'
import { useState } from 'react'

export default function LikeButton({ initialLikes }: { initialLikes: number }) {
  const [likes, setLikes] = useState(initialLikes)

  return (
    <>
      <p>Total Likes: {likes}</p>
      <button
        onClick={async () => {
          const updatedLikes = await incrementLike()
          setLikes(updatedLikes)
        }}
      >
        Like
      </button>
    </>
  )
}
```

## Examples

### Showing a pending state

While executing a Server Function, you can show a loading indicator with React's `useActionState` hook. This hook returns a `pending` boolean.

### Revalidate data

After performing a mutation, you can revalidate the Next.js cache and show the updated data by calling `revalidatePath` or `revalidateTag` within the Server Function:

```ts filename="app/lib/actions.ts"
import { auth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

export async function createPost(formData: FormData) {
  'use server'
  const session = await auth()
  if (!session?.user) {
    throw new Error('Unauthorized')
  }
  // Mutate data
  revalidatePath('/posts')
}
```

### Redirect after a mutation

You may want to redirect the user to a different page after a mutation. You can do this by calling `redirect` within the Server Function.

```ts filename="app/lib/actions.ts"
'use server'

import { auth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function createPost(formData: FormData) {
  const session = await auth()
  if (!session?.user) {
    throw new Error('Unauthorized')
  }
  // Mutate data
  revalidatePath('/posts')
  redirect('/posts')
}
```

Calling `redirect` throws a framework handled control-flow exception. Any code after it won't execute.

### Cookies

You can `get`, `set`, and `delete` cookies inside a Server Action using the `cookies` API.

```ts filename="app/actions.ts"
'use server'

import { cookies } from 'next/headers'

export async function exampleAction() {
  const cookieStore = await cookies()

  cookieStore.get('name')?.value
  cookieStore.set('name', 'Delba')
  cookieStore.delete('name')
}
```

When you set or delete a cookie in a Server Action, Next.js re-renders the current page and its layouts on the server so the UI reflects the new cookie value.
