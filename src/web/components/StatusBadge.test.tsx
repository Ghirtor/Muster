import { render, screen } from '@testing-library/react'

import StatusBadge from './StatusBadge'

describe('StatusBadge', () => {
  it('names the state in words, not colour alone', () => {
    render(<StatusBadge status="error" />)
    expect(screen.getByText('Crashed')).toBeInTheDocument()
  })

  it('takes a custom label', () => {
    render(<StatusBadge status="ok" label="Listening" />)
    expect(screen.getByText('Listening')).toHaveClass('text-status-ok')
  })
})
