/**
 * React Fiber info extraction — reads internal React properties from DOM elements.
 * Works in React 16+ (Fiber architecture).
 */

export interface FiberInfo {
  componentName: string | null
  sourceFile: string | null
  sourceLine: number | null
  props: Record<string, unknown>
}

// React attaches fiber nodes as properties like __reactFiber$xxxxx
function getFiberFromElement(el: Element): Record<string, unknown> | null {
  const key = Object.keys(el).find((k) => k.startsWith('__reactFiber$'))
  if (!key) return null
  return (el as Record<string, unknown>)[key] as Record<string, unknown> | null
}

function getPropsFromElement(el: Element): Record<string, unknown> | null {
  const key = Object.keys(el).find((k) => k.startsWith('__reactProps$'))
  if (!key) return null
  return (el as Record<string, unknown>)[key] as Record<string, unknown> | null
}

function getComponentName(fiber: Record<string, unknown>): string | null {
  const type = fiber['type']
  if (typeof type === 'string') return type
  if (typeof type === 'function' && type.name) return type.name
  if (type && typeof type === 'object' && 'displayName' in type) {
    return (type as Record<string, unknown>)['displayName'] as string ?? null
  }
  return null
}

function getSourceInfo(fiber: Record<string, unknown>): { file: string | null; line: number | null } {
  const debugSource = fiber['_debugSource'] as Record<string, unknown> | undefined
  if (debugSource) {
    return {
      file: (debugSource['fileName'] as string) ?? null,
      line: (debugSource['lineNumber'] as number) ?? null,
    }
  }

  // Try _debugOwner as fallback
  const owner = fiber['_debugOwner'] as Record<string, unknown> | undefined
  if (owner) {
    const ownerSource = owner['_debugSource'] as Record<string, unknown> | undefined
    if (ownerSource) {
      return {
        file: (ownerSource['fileName'] as string) ?? null,
        line: (ownerSource['lineNumber'] as number) ?? null,
      }
    }
  }

  return { file: null, line: null }
}

export function extractFiberInfo(el: Element): FiberInfo {
  const fiber = getFiberFromElement(el)

  if (!fiber) {
    return { componentName: null, sourceFile: null, sourceLine: null, props: {} }
  }

  const componentName = getComponentName(fiber)
  const { file, line } = getSourceInfo(fiber)
  const rawProps = getPropsFromElement(el)

  // Filter out non-serializable props
  const props: Record<string, unknown> = {}
  if (rawProps) {
    for (const [key, value] of Object.entries(rawProps)) {
      if (key === 'children' || key === 'ref' || key === 'key') continue
      if (typeof value === 'function') continue
      if (value === undefined || value === null) continue
      try {
        JSON.stringify(value)
        props[key] = value
      } catch {
        // Skip non-serializable values
      }
    }
  }

  return { componentName, sourceFile: file, sourceLine: line, props }
}

export function getComponentBreadcrumb(el: Element): string[] {
  const fiber = getFiberFromElement(el)
  if (!fiber) return []

  const breadcrumb: string[] = []
  let current: Record<string, unknown> | undefined = fiber

  while (current && breadcrumb.length < 10) {
    const name = getComponentName(current)
    if (name) breadcrumb.push(name)
    current = current['return'] as Record<string, unknown> | undefined
  }

  return breadcrumb.reverse()
}
