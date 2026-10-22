// House rules oxlint has no native equivalent for. Each rule reports every node matching one of
// its selectors, the way ESLint's no-restricted-syntax does; they are split in two so the colour
// rule can be switched off for colour data without also dropping the module-shape rule.

// what a module exports and how components are declared — applies to every file
const moduleShapeRestrictions = [
  {
    selector: 'ExportNamedDeclaration[source]',
    message:
      'A module exports what it declares. Import from the module that declares it rather than handing its export on, which gives the same thing two import paths.'
  },
  {
    selector: 'ExportAllDeclaration',
    message:
      'A module exports what it declares. Import from the module that declares it rather than handing its exports on, which gives the same things two import paths.'
  },
  {
    selector: 'ExportNamedDeclaration:not([source]):not([declaration])',
    message:
      'Export at the declaration itself. An export list is how an imported binding gets handed on without naming the module it came from.'
  },
  {
    selector:
      ':matches(TSInterfaceDeclaration, TSTypeAliasDeclaration)[id.name=/Props$/] TSPropertySignature[key.name="children"]',
    message:
      'Wrap the props in `PropsWithChildren` rather than typing `children` by hand, so a component that takes children says so the one way.'
  },
  {
    selector: ':matches(ExportNamedDeclaration, ExportDefaultDeclaration) > FunctionDeclaration',
    message:
      'Declare it as a const holding an arrow function, and export that. A component is `const X: FC<Props> = ...` with a default export.'
  }
]

const COLOUR_TOKEN_MESSAGE =
  'Use a semantic colour token from src/web/styles/semantic.css (bg-brand, text-ink-muted, border-status-error, var(--color-…)), so the Flotilla tokens stay the one source of colour.'

const COLOUR_FUNCTION = String.raw`#[0-9a-fA-F]{3,8}\b|\b(rgba?|hsla?|oklch)\(`
const PALETTE_UTILITY = String.raw`\b(bg|text|border(-[trblxyse])?|fill|stroke|from|to|via|ring(-offset)?|outline|shadow|inset-shadow|drop-shadow|divide|placeholder|accent|caret|decoration)-(white|black|gray|slate|zinc|neutral|stone|mauve|mist|olive|taupe|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)\b`
const COLOUR_PROPS = String.raw`^(fill|stroke|stopColor|floodColor|color|lineColor)$`
const NAMED_COLOUR = String.raw`^(white|black|red|green|blue|gray|grey|yellow|orange|purple|pink)$`

// colours are tokens: a literal here is a colour no theme can reach
const colourRestrictions = [
  ...[COLOUR_FUNCTION, PALETTE_UTILITY].flatMap((source) =>
    ['Literal[value', 'TemplateElement[value.raw'].map((head) => ({
      selector: `${head}=/${source}/]`,
      message: COLOUR_TOKEN_MESSAGE
    }))
  ),
  ...['', 'JSXExpressionContainer > '].map((container) => ({
    selector: `JSXAttribute[name.name=/${COLOUR_PROPS}/] > ${container}Literal[value=/${NAMED_COLOUR}/]`,
    message: COLOUR_TOKEN_MESSAGE
  }))
]

const restrictSyntax = (restrictions) => ({
  meta: { type: 'suggestion', schema: [] },
  create: (context) => {
    const visitors = {}
    for (const { selector, message } of restrictions) {
      const report = (node) => {
        context.report({ node, message })
      }
      const previous = visitors[selector]
      visitors[selector] = previous
        ? (node) => {
            previous(node)
            report(node)
          }
        : report
    }
    return visitors
  }
})

export default {
  meta: { name: 'house' },
  rules: {
    'module-shape': restrictSyntax(moduleShapeRestrictions),
    'colour-tokens': restrictSyntax(colourRestrictions)
  }
}
