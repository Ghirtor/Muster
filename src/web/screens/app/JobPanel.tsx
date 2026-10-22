import type { FC } from 'react'

import { useCancelJobMutation, useGetJobQuery } from '../../api/flotillaApi'
import type { Job } from '../../api/flotillaApi.types'
import Button from '../../components/Button'
import Console from '../../components/Console'
import Panel from '../../components/Panel'
import StatusBadge from '../../components/StatusBadge'
import { clock } from '../../format'
import { jobText, jobTone } from '../jobText'

type JobPanelProps = Readonly<{ job: Job }>

/** The app's latest action with its CLI output as it runs, and Cancel while it does. */
const JobPanel: FC<JobPanelProps> = ({ job }) => {
  const { data } = useGetJobQuery(job.id)
  const [cancel, { isLoading }] = useCancelJobMutation()

  const current = data?.job ?? job
  const running = current.state === 'running'

  return (
    <Panel
      title={
        <span className="flex items-center gap-3">
          Last action
          <StatusBadge status={jobTone(current)} label={jobText(current)} />
          <span className="font-mono text-xs font-normal text-ink-faint">
            {clock(current.startedAt)}
          </span>
        </span>
      }
      labelledBy="job-heading"
      actions={
        running ? (
          <Button
            small
            disabled={isLoading}
            onClick={() => {
              void cancel(current.id)
            }}
          >
            Cancel
          </Button>
        ) : null
      }
    >
      <div className="px-5 pb-5">
        <Console
          text={data?.output ?? ''}
          label="Action output"
          follow
          empty={running ? 'Waiting for output…' : 'No output.'}
          className="max-h-72"
        />
      </div>
    </Panel>
  )
}

export default JobPanel
