import { validateTutorialScript } from '@pecie/schemas'

import exportBasicsScriptJson from '../tutorials/local/export-basics.json'
import launcherBasicsScriptJson from '../tutorials/local/launcher-basics.json'
import timelineBasicsScriptJson from '../tutorials/local/timeline-basics.json'
import workspaceBasicsScriptJson from '../tutorials/local/workspace-basics.json'

export const tutorialStepActions = {
  click: 'click',
  focus: 'focus',
  waitVisible: 'wait-visible',
  waitDocumentOpen: 'wait-document-open',
  switchWorkspaceView: 'switch-workspace-view'
} as const

export const tutorialStepTargetKinds = {
  selector: 'selector',
  tutorialId: 'tutorial-id',
  workspaceView: 'workspace-view'
} as const

const tutorialScriptList = [
  validateTutorialScript(launcherBasicsScriptJson),
  validateTutorialScript(workspaceBasicsScriptJson),
  validateTutorialScript(timelineBasicsScriptJson),
  validateTutorialScript(exportBasicsScriptJson)
]

export const tutorialScripts = Object.fromEntries(tutorialScriptList.map((script) => [script.id, script])) as Record<
  string,
  (typeof tutorialScriptList)[number]
>
