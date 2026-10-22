import { appOf, lockOf, REPO, snapshotOf } from '../__mocks__/fixtures'
import type { BrokenApp } from '../api/musterApi.types'
import { appName, appStatus, isTaken, matches, ownHold } from './appStatus'

const broken: BrokenApp = { id: 'demo', file: 'sample.yaml', ok: false, problems: ['name: missing'] }

describe('appStatus', () => {
  it('names the rig state', () => {
    expect(appStatus(appOf())).toEqual({ status: 'idle', label: 'Stopped' })
    expect(appStatus(appOf(snapshotOf([lockOf(REPO)])))).toEqual({ status: 'ok', label: 'Running' })
    expect(appStatus(broken)).toEqual({ status: 'error', label: 'Config broken' })
  })
})

describe('appName', () => {
  it('is the config name, or the id when the config does not load', () => {
    expect(appName(appOf())).toBe('Demo')
    expect(appName(broken)).toBe('demo')
  })
})

describe('matches', () => {
  it('finds an app by name, process or port, ignoring case', () => {
    expect(matches(appOf(), 'DEMO')).toBe(true)
    expect(matches(appOf(), 'web')).toBe(true)
    expect(matches(appOf(), '7002')).toBe(true)
    expect(matches(appOf(), 'postgres')).toBe(false)
    expect(matches(appOf(), '  ')).toBe(true)
  })
})

describe('isTaken and ownHold', () => {
  it('tells this checkout’s hold from another’s and from a foreign rig', () => {
    const mine = appOf(snapshotOf([lockOf('c:/dev/demo/')]))
    const theirs = appOf(snapshotOf([lockOf('C:\\dev\\Other')]))
    const foreign = snapshotOf([], { foreign: true })

    expect(ownHold(mine)?.repo).toBe('c:/dev/demo/')
    expect(ownHold(theirs)).toBeNull()
    expect(isTaken(theirs.snapshot)).toBe(true)
    expect(isTaken(foreign)).toBe(true)
    expect(isTaken(snapshotOf())).toBe(false)
  })
})
