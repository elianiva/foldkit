# Slider

## Overview

A numeric range input for values that sit on a continuous or stepped scale. Common uses include rating scales, volume controls, filter thresholds, and brightness settings. Follows the WAI-ARIA slider pattern with `role="slider"`, full keyboard navigation, and pointer drag.

:::Info{label="See it in an app"}
Check out how Slider is wired up in a [real Foldkit app](https://github.com/foldkit/foldkit/blob/main/examples/ui-showcase/src/ui/view/slider.ts).
:::

## Examples

Slider is headless. Your `toView` callback controls all markup and styling. The component hands back attribute groups for the root, track, filled track, thumb, label, and an optional hidden input for form submission.

::Demo{name="slider"}

::Snippet{name="uiSliderBasic" label="slider example"}

## Subscriptions

Pointer drag needs document-level `pointermove` / `pointerup` tracking (the cursor can leave the slider element). Slider exposes this as a Subscription you wire into your app’s `subscriptions` alongside an Escape-key Subscription that cancels an in-progress drag. The example snippet above shows the full wiring.

## Styling

Slider exposes `data-dragging` while the user is actively dragging, `data-disabled` when disabled, `data-readonly` when read-only, and `data-orientation` plus boolean `data-horizontal` / `data-vertical` on the root and track. The track also carries `data-thumb-alignment` (`"center"` or `"edge"`). The `filledTrack` attribute group carries an inline size so the filled portion always matches the current value: width for horizontal, height for vertical. The thumb is center-aligned by default so the thumb's center sits on the value point. Pass `thumbAlignment: 'Edge'` with `thumbSize` matching your thumb styling to keep the thumb fully inside the track at the extremes. Pointer input (click-to-jump and drag) maps across the same inset range the thumb travels through, measured from the rendered thumb element, so the value under the pointer matches the thumb position.

| Attribute              | Condition                                                                                |
| ---------------------- | ---------------------------------------------------------------------------------------- |
| `data-dragging`        | Present on the root, track, filled track, and thumb while the user is actively dragging. |
| `data-disabled`        | Present on all groups when isDisabled is true.                                           |
| `data-readonly`        | Present on all groups when isReadOnly is true.                                           |
| `data-orientation`     | Present on the root and track. `"horizontal"` or `"vertical"`, matching `orientation`.   |
| `data-horizontal`      | Present on the root and track when `orientation` is `"horizontal"`.                      |
| `data-vertical`        | Present on the root and track when `orientation` is `"vertical"`.                        |
| `data-thumb-alignment` | Present on the track. `"center"` or `"edge"`, matching `thumbAlignment`.                 |

## Keyboard Interaction

| Key                     | Description                                                              |
| ----------------------- | ------------------------------------------------------------------------ |
| `ArrowRight / ArrowUp`  | Increases the value by one step.                                         |
| `ArrowLeft / ArrowDown` | Decreases the value by one step.                                         |
| `PageUp`                | Increases the value by ten steps.                                        |
| `PageDown`              | Decreases the value by ten steps.                                        |
| `Home`                  | Jumps to the minimum value.                                              |
| `End`                   | Jumps to the maximum value.                                              |
| `Escape`                | During a pointer drag, cancels the drag and restores the pre-drag value. |

Every key in this table is inert when `isDisabled` or `isReadOnly` is true, because both remove the thumb's keydown handler. Escape is the exception. It cancels a drag through a Subscription rather than the handler, so a drag that began before the slider became read-only can still be cancelled, and can still run to pointerup on its own. Flipping `isReadOnly` mid-drag does not interrupt the drag in flight. `isDisabled` behaves the same way.

## Accessibility

The thumb receives `role="slider"`, `aria-valuemin`, `aria-valuemax`, `aria-valuenow`, and `aria-orientation`. When `formatValue` is provided, the formatted string is announced via `aria-valuetext`. By default the thumb is labeled via `aria-labelledby` pointing at the id carried on the `label` attribute group; you can override this with an explicit `ariaLabel` or `ariaLabelledBy`.

`isReadOnly` and `isDisabled` both stop the Slider from reacting to pointer drags and keys. They differ in the semantics exposed to assistive technology, so they are not interchangeable.

`aria-disabled="true"`, which `isDisabled` emits, communicates that the Slider is unavailable. `aria-readonly="true"`, which `isReadOnly` emits, communicates that its value cannot be changed but remains relevant to the user. It sits on the thumb, the element carrying `role="slider"`. Both states keep `tabindex="0"`, following Foldkit's convention that unavailable controls remain discoverable by keyboard and assistive technology.

Assistive technology support for `aria-readonly` on sliders varies. Pair it with a visible read-only treatment or explanatory text when users must distinguish it from disabled, and test the browser and assistive technology combinations your app supports.

Use `isReadOnly` when the value is still information the user needs, such as a level set by another control, and `isDisabled` when the Slider is unavailable.

The two flags are independent. Setting both emits both sets of attributes, and either one on its own removes the pointer and keyboard handlers.

## API Reference

### InitConfig {#init-config}

Configuration object passed to `Slider.init()`.

| Name   | Type     | Default | Description                                                                                                                   |
| ------ | -------- | ------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `id`   | `string` | —       | Unique ID for the slider instance.                                                                                            |
| `min`  | `number` | —       | Minimum value.                                                                                                                |
| `max`  | `number` | —       | Maximum value.                                                                                                                |
| `step` | `number` | —       | Increment between allowed values. Fractional steps are rounded to the step’s decimal precision to avoid floating-point drift. |

### ViewConfig {#view-config}

Configuration object passed to `Slider.view()`.

| Name              | Type                                              | Default        | Description                                                                                                                                                                                                                            |
| ----------------- | ------------------------------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `model`           | `Slider.Model`                                    | —              | The slider state from your parent Model.                                                                                                                                                                                               |
| `toParentMessage` | `(childMessage: Slider.Message) => ParentMessage` | —              | Wraps Slider Messages in your parent Message type for Submodel delegation.                                                                                                                                                             |
| `value`           | `number`                                          | —              | The current value, read from your parent Model. The thumb position, aria-valuenow, and filled track derive from it. Fold the ChangedValue OutMessage into this field in your update.                                                   |
| `orientation`     | `"Horizontal" \| "Vertical"`                      | `"Horizontal"` | Layout axis for the track, range, and thumb. Vertical puts `min` at the bottom and `max` at the top and switches `aria-orientation`, pointer mapping, and filled-track sizing. DOM attributes stay lowercase.                          |
| `thumbAlignment`  | `"Center" \| "Edge"`                              | `"Center"`     | How the thumb aligns within the track. `Center` keeps the thumb's center on the value point and lets it overflow by half its size at the extremes. `Edge` insets the thumb's travel by `thumbSize` so it stays fully inside the track. |
| `thumbSize`       | `string`                                          | `"0.75rem"`    | CSS length of the thumb along the track axis, used only with `Edge` alignment. Set it to the size your `toView` callback styles the thumb with so the fill meets the thumb's center.                                                   |
| `toView`          | `(attributes: SliderAttributes) => Html`          | —              | Callback that receives attribute groups for the root, track, filled track, thumb, label, and hidden input elements.                                                                                                                    |
| `ariaLabel`       | `string`                                          | —              | Accessible name for screen readers when there is no visible label.                                                                                                                                                                     |
| `ariaLabelledBy`  | `string`                                          | —              | ID of an external element whose text serves as the slider’s accessible name.                                                                                                                                                           |
| `formatValue`     | `(value: number) => string`                       | —              | Produces the aria-valuetext announced to screen readers. Use it when the numeric value needs a natural-language form (e.g. "3 of 10" or "50 percent").                                                                                 |
| `isDisabled`      | `boolean`                                         | `false`        | Whether the slider is disabled. Removes pointer and keyboard interactivity while preserving focusability.                                                                                                                              |
| `isReadOnly`      | `boolean`                                         | `false`        | Whether the slider is readable but not adjustable. Carries `aria-readonly` rather than `aria-disabled`. Independent of `isDisabled`. Removes pointer and keyboard interactivity while preserving focusability.                         |
| `name`            | `string`                                          | —              | Form field name. When provided, a hidden input carrying the current numeric value is included for native form submission.                                                                                                              |
| `getTrackRoot`    | `(() => Document \| ShadowRoot) \| undefined`     | —              | Optional accessor returning the DOM root that contains the slider track. Defaults to `document`. Override when rendering inside a Shadow DOM so the drag subscription can find the track element to measure cursor position.           |

### SliderAttributes {#slider-attributes}

Attribute groups provided to the `toView` callback.

| Name          | Type                                | Default | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------- | ----------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `root`        | `ReadonlyArray<Attribute<Message>>` | —       | Spread onto the outer wrapper. Carries `data-slider-id`, `data-orientation` (`horizontal` or `vertical`), boolean `data-horizontal` / `data-vertical`, and state data attributes.                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `track`       | `ReadonlyArray<Attribute<Message>>` | —       | Spread onto the track element (the bar). Carries `data-slider-track-id` (used by the drag subscription to measure cursor position), `data-orientation` and `data-horizontal` / `data-vertical`, `data-thumb-alignment` (`center` or `edge`), positioning styles, and the pointerdown handler for click-to-jump. The handler and `valueFromPointer` read the track element's own orientation only, so a horizontal slider nested inside a vertical one still maps pointer events on the X axis. With `Edge` alignment the mapping runs across the inset thumb range measured from the rendered thumb element. |
| `filledTrack` | `ReadonlyArray<Attribute<Message>>` | —       | Spread onto an element nested inside the track. Its inline size reflects the current value as a percentage of the range: `width` for horizontal, `height` for vertical. `Edge` alignment insets the size by `thumbSize` so the fill stays aligned with the inset thumb's center.                                                                                                                                                                                                                                                                                                                             |
| `thumb`       | `ReadonlyArray<Attribute<Message>>` | —       | Spread onto the draggable handle. Carries `role="slider"`, `tabindex`, `aria-valuemin` / `aria-valuemax` / `aria-valuenow`, `aria-orientation` (matching `orientation`, lowercased), the pointerdown handler, the keyboard handler, and positioning. `Center` positions with `left: N% + translateX(-50%)` (horizontal) or `bottom: N% + translateY(50%)` (vertical); `Edge` insets the travel by `thumbSize`.                                                                                                                                                                                               |
| `label`       | `ReadonlyArray<Attribute<Message>>` | —       | Spread onto the visible label element. Carries the id the thumb’s aria-labelledby points to by default.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `hiddenInput` | `ReadonlyArray<Attribute<Message>>` | —       | Spread onto a hidden `<input>` for form submission. Only populated when the name prop is set.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

### OutMessage {#out-message}

Messages emitted to the parent through the optional `outMessage` field. Parents fold the OutMessage in the `foldOutMessage` of their [`Update.foldChild`](/core/submodel#fold-child) config.

| Name           | Type                | Default | Description                                                                                                                                                                                                                         |
| -------------- | ------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ChangedValue` | `{ value: number }` | —       | Emitted whenever the slider value changes via drag, click-to-jump, or keyboard navigation. Fold it in the `foldOutMessage` of your Slider fold to react, for example: persist the value, validate, or trigger a downstream Command. |
