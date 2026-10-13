/** The CSS colour of a branch palette entry (see --branch-N in index.css); muted for the uncoloured root. */
export const branchVar = (color: number | undefined) =>
  color === undefined ? 'var(--muted-foreground)' : `var(--branch-${color})`
