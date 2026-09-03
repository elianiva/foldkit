import { Submodel } from 'foldkit'
import type { Html } from 'foldkit/html'

import { slotDocPage } from '../../markdown'
import { type RenderHeadingLink, demoContainer } from '../../prose'
import type { RenderCopyButton } from '../../view/codeBlock'
import type { Message } from './message'
import * as Meter from './meter'
import raw from './meterPage.md'
import type { Model } from './model'

const { tableOfContents, view: renderPage } = slotDocPage<
  'basic' | 'thresholds'
>(raw, 'ui/meter')

export { tableOfContents }

type ViewInputs = Readonly<{
  renderCopyButton: RenderCopyButton
  renderHeadingLink: RenderHeadingLink
}>

export const view = Submodel.defineView<Model, Message, ViewInputs>(
  (_model, { renderCopyButton, renderHeadingLink }, h): Html =>
    renderPage({
      demos: {
        basic: demoContainer(...Meter.basicDemo(h)),
        thresholds: demoContainer(...Meter.thresholdsDemo(h)),
      },
      renderCopyButton,
      renderHeadingLink,
    }),
)
