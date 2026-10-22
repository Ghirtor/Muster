import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { Provider } from 'react-redux'

import { appOf, jobOf, lockOf, REPO, snapshotOf } from './__mocks__/fixtures'
import type { AppView, HttpRequest, Job } from './api/flotillaApi.types'
import { waitForJob } from './api/socket'
import App from './App'
import { makeStore } from './store/store'

// The API boundary: axios and the shared WebSocket are the only things jsdom cannot provide.
jest.mock('./api/http', () => ({ http: { request: jest.fn() } }))
jest.mock('./api/socket', () => ({
  subscribe: jest.fn(() => () => undefined),
  waitForJob: jest.fn()
}))

const request = jest.requireMock<{ http: { request: jest.Mock } }>('./api/http').http.request
const waitFor_ = waitForJob as unknown as jest.Mock

interface Server {
  apps: AppView[]
  posted: { url: string; data: unknown }[]
  config?: string
}

/** The supervisor's answer to one request, recording every write in `server`. */
const answer = (server: Server, { url, method = 'GET', data }: HttpRequest): { data: unknown } => {
  if (method !== 'GET') server.posted.push({ url, data })
  if (url === '/health') return { data: { ok: true, hostname: 'DESKTOP-TEST' } }
  if (url === '/apps') return { data: server.apps }
  if (url === '/jobs') return { data: [] }
  if (url === '/apps/demo/config' && method === 'GET') {
    return { data: { file: 'sample.yaml', text: server.config ?? '', problems: null } }
  }
  if (url === '/apps/demo/config/validate') {
    return { data: { ok: false, problems: ['processes.api.ports: expected a number'] } }
  }
  if (url === '/apps/demo/config') return { data: server.apps.at(0) }
  if (url === '/apps/demo/actions') {
    const { action } = data as { action: Job['action'] }
    return { data: jobOf({ id: `job-${server.posted.length}`, action, state: 'running' }) }
  }
  throw new Error(`unexpected ${method} ${url}`)
}

/** Answers the dashboard's requests from `server`. */
const serve = (server: Server): void => {
  request.mockImplementation(
    async (sent: HttpRequest) => await Promise.resolve(answer(server, sent))
  )
}

/** Renders the dashboard at `hash` over a fresh store. */
const renderAt = (hash: string): void => {
  window.location.hash = hash
  render(
    <Provider store={makeStore()}>
      <App />
    </Provider>
  )
}

/** Waits for the running actions to end, which frees their buttons. */
const settled = async (): Promise<void> => {
  await waitFor(() => {
    expect(document.querySelector('button:disabled')).toBeNull()
  })
}

/** The actions posted, without the URL. */
const actionsOf = (server: Server): unknown[] => server.posted.map((post) => post.data)

beforeEach(() => {
  jest.useFakeTimers({ now: Date.parse('2026-10-22T10:00:00.000Z'), advanceTimers: true })
  request.mockReset()
  waitFor_.mockReset()
})

afterEach(() => {
  jest.useRealTimers()
})

describe('Fleet', () => {
  it('lists the apps with the machine and their rig state', async () => {
    serve({ apps: [appOf()], posted: [] })
    renderAt('#/')

    const table = await screen.findByRole('table')
    expect(within(table).getByRole('link', { name: 'Demo' })).toBeInTheDocument()
    expect(within(table).getByText('Stopped')).toBeInTheDocument()
    expect(screen.getAllByText('DESKTOP-TEST').length).toBeGreaterThan(0)
  })

  it('offers the launch-blocked dialog when another checkout holds the rig, and takes it over', async () => {
    const server: Server = { apps: [appOf(snapshotOf([lockOf('C:\\dev\\Other')]))], posted: [] }
    serve(server)
    waitFor_.mockResolvedValueOnce(jobOf({ outcome: 'busy', exitCode: 3 }))
    renderAt('#/apps/demo')

    fireEvent.click(await screen.findByRole('button', { name: 'Launch' }))
    const dialog = await screen.findByRole('dialog', { name: 'Demo is held by another checkout' })
    expect(within(dialog).getByText('Other ·', { exact: false })).toBeInTheDocument()

    waitFor_.mockResolvedValue(jobOf())
    fireEvent.click(within(dialog).getByRole('radio', { name: /Take it over now/ }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Take it over' }))

    await waitFor(() => {
      expect(actionsOf(server)).toEqual([
        { action: 'up', reason: 'launched from the dashboard' },
        { action: 'down', force: true },
        { action: 'up', reason: 'launched from the dashboard' }
      ])
    })
    await settled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('joins the queue from the dialog', async () => {
    const server: Server = { apps: [appOf(snapshotOf([lockOf('C:\\dev\\Other')]))], posted: [] }
    serve(server)
    waitFor_.mockResolvedValueOnce(jobOf({ outcome: 'busy', exitCode: 3 }))
    renderAt('#/apps/demo')

    fireEvent.click(await screen.findByRole('button', { name: 'Launch' }))
    waitFor_.mockResolvedValue(jobOf())
    fireEvent.click(await screen.findByRole('button', { name: 'Join queue' }))

    await waitFor(() => {
      expect(actionsOf(server).at(-1)).toEqual({
        action: 'up',
        reason: 'launched from the dashboard',
        wait: true
      })
    })
    await settled()
  })

  it('cancels the dialog with Escape', async () => {
    serve({ apps: [appOf(snapshotOf([lockOf('C:\\dev\\Other')]))], posted: [] })
    waitFor_.mockResolvedValueOnce(jobOf({ outcome: 'busy', exitCode: 3 }))
    renderAt('#/apps/demo')

    fireEvent.click(await screen.findByRole('button', { name: 'Launch' }))
    await screen.findByRole('dialog')
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('App detail', () => {
  it('shows who holds the rig and releases it when it is this checkout', async () => {
    const server: Server = { apps: [appOf(snapshotOf([lockOf(REPO)]))], posted: [] }
    serve(server)
    waitFor_.mockResolvedValue(jobOf({ action: 'release' }))
    renderAt('#/apps/demo')

    expect(await screen.findByText('this checkout')).toBeInTheDocument()
    expect(screen.getAllByText('Listening')).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: 'Release rig' }))

    await waitFor(() => {
      expect(actionsOf(server)).toEqual([{ action: 'release' }])
    })
    await settled()
  })

  it('reports a failed action and dismisses it', async () => {
    serve({ apps: [appOf()], posted: [] })
    waitFor_.mockResolvedValue(jobOf({ outcome: 'failed', exitCode: 1 }))
    renderAt('#/apps/demo')

    fireEvent.click(await screen.findByRole('button', { name: 'Launch' }))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('up failed')
    fireEvent.click(within(alert).getByRole('button', { name: 'Dismiss' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('says so when no app has the id', async () => {
    serve({ apps: [appOf()], posted: [] })
    renderAt('#/apps/nope')

    expect(await screen.findByText(/No app is called/)).toBeInTheDocument()
  })
})

describe('Config editor', () => {
  it('validates the draft without saving, then saves it', async () => {
    const server: Server = { apps: [appOf()], posted: [], config: 'name: Demo\n' }
    serve(server)
    renderAt('#/apps/demo/config')

    const text = await screen.findByLabelText('Config text')
    expect(screen.getByRole('button', { name: 'Save config' })).toBeDisabled()
    fireEvent.change(text, { target: { value: 'name: Demo\n# edited' } })
    fireEvent.click(screen.getByRole('button', { name: 'Validate' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'processes.api.ports: expected a number'
    )
    fireEvent.click(screen.getByRole('button', { name: 'Save config' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Saved sample.yaml.')
    expect(server.posted.map((post) => post.url)).toEqual([
      '/apps/demo/config/validate',
      '/apps/demo/config'
    ])
    expect(actionsOf(server).at(-1)).toEqual({ text: 'name: Demo\n# edited' })
  })
})

describe('Supervisor down', () => {
  it('says the supervisor is not answering', async () => {
    request.mockRejectedValue(new Error('Network Error'))
    renderAt('#/')

    expect(await screen.findByText(/The supervisor is not answering/)).toBeInTheDocument()
  })
})
