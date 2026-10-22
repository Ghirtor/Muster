import { jobOf } from '../__mocks__/fixtures'
import { jobText, jobTone } from './jobText'

describe('jobText', () => {
  it('says what the job did and how it ended', () => {
    expect(jobText(jobOf())).toBe('Launch done')
    expect(jobText(jobOf({ action: 'down', outcome: 'failed' }))).toBe('Stop failed')
    expect(jobText(jobOf({ action: 'release', state: 'running', outcome: null }))).toBe(
      'Release running'
    )
    expect(jobText(jobOf({ outcome: 'busy' }))).toBe(
      'Launch blocked: another checkout holds the rig'
    )
  })
})

describe('jobTone', () => {
  it('is warn while running, then follows the outcome', () => {
    expect(jobTone(jobOf({ state: 'running', outcome: null }))).toBe('warn')
    expect(jobTone(jobOf())).toBe('ok')
    expect(jobTone(jobOf({ state: 'cancelled', outcome: 'cancelled' }))).toBe('idle')
    expect(jobTone(jobOf({ outcome: 'usage' }))).toBe('error')
  })
})
