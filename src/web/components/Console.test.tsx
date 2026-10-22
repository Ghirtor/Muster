import { render, screen } from '@testing-library/react'

import Console from './Console'

describe('Console', () => {
  it('colours errors, warnings and readiness lines', () => {
    render(
      <Console label="API log" text={'starting\nERROR boom\nwarning: slow\nNow listening\n'} />
    )

    expect(screen.getByRole('log', { name: 'API log' })).toBeInTheDocument()
    expect(screen.getByText('ERROR boom')).toHaveClass('text-console-error')
    expect(screen.getByText('warning: slow')).toHaveClass('text-console-warn')
    expect(screen.getByText('Now listening')).toHaveClass('text-console-ok')
    expect(screen.getByText('starting')).not.toHaveClass('text-console-error')
  })

  it('shows the empty message with no text', () => {
    render(<Console label="API log" text="" empty="No output yet." />)

    expect(screen.getByText('No output yet.')).toBeInTheDocument()
  })
})
