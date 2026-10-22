---
paths:
  - "src/**/*.{ts,tsx}"
---

# Conventions

Coding conventions for React with TypeScript. It defines how to write good components, props, hooks and styles with Tailwind 4 and the Muster tokens.
By keeping in mind accessibility, performances with react-compiler and testability.

They apply to every `.ts` and `.tsx` file written or changed under `src/`, whatever the
task is called — wiring a button, fixing a bug, or a refactor. The linter
(`house/module-shape`, `import/no-named-export`) catches the mechanical part; the judgement
part — one job per component, no mode flag piled onto a shared component, the component
structure order, comments only as docstrings on functions — is yours to apply.

## Exports & Naming

### Default export for a component or a hook

A component and a hook are what their file is for, so each is declared as a const and default
exported. A module that is not one — a helper, a set of constants, a slice — exports by name.

```typescript
// ✅ Good — Button.tsx
const Button: FC<ButtonProps> = ({ label }) => { ... }

export default Button

// ✅ Good — useAuth.ts
const useAuth = (): UseAuthReturn => { ... }

export default useAuth

// ❌ Bad — the component itself named
export const Button: FC<ButtonProps> = ({ label }) => { ... }
```

### Component typing

Always use `FC<Props>` with arrow functions:

```typescript
// ✅ Good
interface ButtonProps {
  label: string
  onPress: VoidFunction
}

const Button: FC<ButtonProps> = ({ label, onPress }) => {
  return <Pressable onPress={onPress}><Text>{label}</Text></Pressable>;
}

export default Button

// ❌ Bad — missing FC
const Button = ({ label }: ButtonProps) => { ... }
```

### Exported types

An exported `interface`, `type` or `enum` lives in a sibling `[Module].types.ts`, and the module
imports it back. A type only that module uses stays inline, unexported. The type guards and constants
that mean nothing without the type may sit with it.

```typescript
// ✅ Good — useAuth.types.ts
export interface UseAuthReturn {
  user: User | null
  signOut: VoidFunction
}

// ✅ Good — useAuth.ts
import type { UseAuthReturn } from './useAuth.types'

interface PendingSession { ... }

const useAuth = (): UseAuthReturn => { ... }

// ✅ Good — a consumer
import type { UseAuthReturn } from '../hooks/useAuth.types'

// ❌ Bad — declared in useAuth.ts
export interface UseAuthReturn { ... }
```

### Naming conventions

| Element          | Convention                  | Example                 |
| ---------------- | --------------------------- | ----------------------- |
| Component        | PascalCase                  | `UserProfile.tsx`       |
| Props interface  | `[Component]Props`          | `UserProfileProps`      |
| Hook             | camelCase with `use` prefix | `useAuth.ts`            |
| Hook return type | `[Hook]Return`              | `UseAuthReturn`         |
| Exported types   | `[Module].types.ts`         | `UserProfile.types.ts`  |

## Component Structure

Order within a component file: imports, then types, then the component — and within the component,
hooks, then derived values, then handlers, then the render.

```typescript
import { FC, useState } from "react";
import { View, Text, Pressable } from "react-native";

type UserCardProps = Readonly<{
  name: string
  avatarUrl?: string
  onPress: VoidFunction
}>

const UserCard: FC<UserCardProps> = ({ name, avatarUrl, onPress }) => {
  const [isPressed, setIsPressed] = useState(false)

  const displayName = name.toUpperCase()

  const handlePress = () => {
    setIsPressed(true)
    onPress()
  };

  return (
    <Pressable onPress={handlePress} className="p-4 bg-white rounded-lg">
      <Text className="text-lg font-bold">{displayName}</Text>
    </Pressable>
  )
}

export default UserCard
```

## Comments

Every comment is a docstring block sitting on top of a class or a function — a method and an accessor
are functions. Nothing else carries one: not a statement, not an interface, not a type, not a const,
not a property, and nothing trailing a line. A constraint that holds at one statement is lifted into
the enclosing docstring, or that statement becomes a named function whose docstring carries it.

Keep it to a line or three, saying what the signature cannot. It records a constraint, not a design
diary, and when the rule it records changes the line is replaced rather than added to.

```typescript
// ✅ Good
/**
 * Told once the panel has settled rather than on every frame it settles over: a caller that redraws
 * on each of them redraws the whole layer per pointer move.
 */
const useSettledSize = (element: RefObject<HTMLElement>): Size => { ... }

// ❌ Bad — above a statement, and trailing one
// windowed, since the panel cannot mount every row
const windowed = rows.length > WINDOW_LIMIT // sixty

// ❌ Bad — an interface is not a function
/** The size the panel settled at. */
interface Size { ... }
```

A `[Module].types.ts` holding only declarations therefore carries no comments at all. A type guard
that lives beside its type takes a docstring like any other function.

(The `// ✅ Good` and `// ❌ Bad` lines in this document annotate the examples; they are not part of
them.)

## Props

### Children with PropsWithChildren

```typescript
// ✅ Good — use PropsWithChildren
type ContainerProps = PropsWithChildren<
  Readonly<{
    padding?: number
  }>
>

// ✅ Good — no additional props
type WrapperProps = PropsWithChildren
```

A `children` field on a `[Component]Props` is refused by the linter. One written into an inline type
literal is not, and is the same mistake.

## Hooks

### One hook per file

```
some/folder
├── useAuth.ts
├── useToggle.ts
└── useDebounce.ts
```

### Explicit return type

```typescript
// ✅ Good
interface UseToggleReturn {
  isOn: boolean
  toggle: VoidFunction
  setOn: VoidFunction
  setOff: VoidFunction
}

const useToggle = (initial = false): UseToggleReturn => {
  const [isOn, setIsOn] = useState(initial)

  return {
    isOn,
    toggle: () => setIsOn((v) => !v),
    setOn: () => setIsOn(true),
    setOff: () => setIsOn(false),
  }
}

export default useToggle
```

## Performance

### React Compiler

React 19+ with React Compiler handles most memoization automatically. Avoid premature optimization:

```typescript
// ✅ With React Compiler — usually no manual memoization needed
const List: FC<ListProps> = ({ items, onItemPress }) => {
  const sortedItems = items.sort((a, b) => a.name.localeCompare(b.name))

  return (
    <FlatList
      data={sortedItems}
      renderItem={({ item }) => (
        <ListItem item={item} onPress={() => onItemPress(item.id)} />
      )}
    />
  )
}

export default List
```

### Conditional styles

```typescript
// ✅ Good — template literals or clsx
<View className={`p-4 ${isActive ? "bg-blue-500" : "bg-gray-200"}`} />

// ❌ Bad — ternary soup
<View className={isActive ? (isLarge ? "p-8 bg-blue-500" : "p-4 bg-blue-500") : "p-4 bg-gray-200"} />
```
