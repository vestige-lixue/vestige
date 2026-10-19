<svelte:window onpointerup={finishPointer} onpointercancel={finishPointer} onblur={() => finish(true)} />

<div class="colorPicker" class:dragging={areaPointer !== null || sliderPointer !== null} data-disabled={disabled || undefined}>
    <div class="layout">
        <div class="area focusable" bind:this={area} tabindex={disabled ? -1 : 0} style:--hue={color.h}
            onpointerdown={startArea} onpointermove={moveArea} onpointerup={endArea}
            onpointercancel={finishPointer} onlostpointercapture={finishPointer} onkeydown={areaKeydown}
        >
            <div class="areaThumb" style:left={`${color.s}%`} style:top={`${100 - color.l}%`}
                style:background-color={hslaToCss({ ...color, a: 1 })}></div>
        </div>
        {#key sliderSession}
            <Slider.Root type="single" class="colorPickerSlider hue" min={0} max={360} step={0.01} {disabled} thumbPositioning="exact"
                value={round(color.h)} onValueChange={h => changeChannel("h", h)} onValueCommit={() => finish()}
                onpointerdowncapture={startSlider} onlostpointercapture={finishPointer}
            >
                <Slider.Thumb id={`${id}-h-slider`} index={0} class="colorPickerThumb focusable"
                    onkeydown={event => sliderKeydown(event, "h")} />
            </Slider.Root>
            {#if alpha}
                <Slider.Root type="single" class="colorPickerSlider alpha" min={0} max={100} step={0.01} {disabled} thumbPositioning="exact"
                    value={round(color.a * 100)} onValueChange={a => changeChannel("a", a)} onValueCommit={() => finish()}
                    onpointerdowncapture={startSlider} onlostpointercapture={finishPointer}
                    style={`--opaque: ${hslaToCss({ ...color, a: 1 })}; --transparent: ${hslaToCss({ ...color, a: 0 })};`}
                >
                    <Slider.Thumb id={`${id}-a-slider`} index={0} class="colorPickerThumb focusable"
                        onkeydown={event => sliderKeydown(event, "a")} />
                </Slider.Root>
            {/if}
        {/key}
        <div class="channels">
            {#each channels as channel (channel)}
                <div class="channel">
                    <Label.Root for={`${id}-${channel}`} class="colorPickerLabel">
                        {channel.toUpperCase()} ({channel === "h" ? "°" : "%"})
                    </Label.Root>
                    <input id={`${id}-${channel}`} class="focusable" class:invalid={parse(channel) === null}
                        type="number" min={0} max={maximum(channel)} step={0.01} {disabled}
                        value={drafts[channel]} onfocus={() => editing = channel}
                        oninput={event => {
                            editing = channel;
                            drafts[channel] = event.currentTarget.value;
                            const next = parse(channel);
                            if (next !== null) changeChannel(channel, next);
                        }}
                        onblur={() => finish()}
                        onkeydown={event => inputKeydown(event, channel)}
                    />
                </div>
            {/each}
        </div>
        <div class="hex">
            <Label.Root for={`${id}-hex`} class="colorPickerLabel">{hexLabel}</Label.Root>
            <div class="hexInput">
                <div class="hexPrefix">#</div>
                <input id={`${id}-hex`} class="focusable" type="text" spellcheck={false} autocomplete="off" {disabled}
                    value={hexDraft} onfocus={() => editing = "hex"}
                    oninput={event => {
                        editing = "hex";
                        hexEdited = true;
                        const input = event.currentTarget;
                        hexDraft = input.value.replace(/^\s*#/, "");
                        const removed = input.value.length - hexDraft.length;
                        if (removed) {
                            const start = Math.max(0, (input.selectionStart ?? 0) - removed);
                            const end = Math.max(0, (input.selectionEnd ?? 0) - removed);
                            input.value = hexDraft;
                            input.setSelectionRange(start, end);
                        }
                    }}
                    onblur={() => finish()}
                    onkeydown={event => {
                        if (event.isComposing) return;
                        if (event.key === "Enter") {
                            event.preventDefault();
                            finish();
                        }
                        else if (event.key === "Escape" && hexEdited) {
                            event.preventDefault();
                            event.stopPropagation();
                            hexEdited = false;
                            finish();
                        }
                    }} />
            </div>
        </div>
    </div>
</div>


<style>
    .colorPicker {
        container-type: inline-size;
        display: flex;
        flex-direction: column;
        flex: 0 1 auto;
        width: var(--color-picker-width, 260px);
        max-width: 100%;
        min-height: 0;
        color: var(--color-picker-text, #252a30);
        font: inherit;
    }
    .layout {
        display: flex;
        flex: 1;
        flex-direction: column;
        gap: clamp(8px, 6cqi, 16px);
        min-height: 0;
    }
    .area {
        position: relative;
        flex: 0 1 auto;
        min-height: 96px;
        height: min(var(--color-picker-area-height, 160px), 62cqi);
        border-radius: 6px;
        background:
            linear-gradient(to bottom in srgb, #fff, #fff0 50%, #0000 50%, #000),
            linear-gradient(to right in srgb, hsl(0 0% 50%), hsl(var(--hue) 100% 50%));
        cursor: crosshair;
        touch-action: none;
        user-select: none;
    }
    .areaThumb, .colorPicker :global(.colorPickerThumb) {
        box-sizing: border-box;
        width: 16px;
        height: 16px;
        border: 2px solid #fff;
        border-radius: 50%;
        box-shadow: 0 0 0 1px #0008;
        transition: none;
    }
    .areaThumb {
        position: absolute;
        transform: translate(-50%, -50%);
        pointer-events: none;
    }
    .colorPicker :global(.colorPickerSlider) {
        position: relative;
        display: block;
        flex-shrink: 0;
        height: 14px;
        border-radius: 7px;
        touch-action: none;
    }
    .colorPicker :global(.colorPickerThumb) {
        top: 50%;
        transform: translateY(-50%);
        background: transparent;
    }
    .colorPicker :global(.hue) {
        background: linear-gradient(to right in srgb, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00);
    }
    .colorPicker :global(.alpha) {
        background:
            linear-gradient(to right in srgb, var(--transparent), var(--opaque)),
            repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 0 0 / 10px 10px;
    }
    .channels {
        display: flex;
        flex-wrap: wrap;
        flex-shrink: 0;
        gap: 8px;
    }
    .channel {
        display: flex;
        flex: 1;
        flex-direction: column;
        gap: 6px;
        min-width: max-content;
    }
    .channel input {
        width: calc(6.25ch + 14px);
        min-width: 100%;
    }
    .hex {
        display: flex;
        flex-wrap: wrap;
        flex-shrink: 0;
        align-items: center;
        gap: 8px 16px;
    }
    .hexInput {
        position: relative;
        flex: 1 0 calc(9ch + 20px);
        width: 0;
        min-width: calc(9ch + 20px);
        font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
        font-size: 13px;
    }
    .hexInput input {
        padding-left: calc(1ch + 12px);
    }
    .hexPrefix {
        position: absolute;
        top: 0;
        bottom: 0;
        left: 7px;
        display: flex;
        align-items: center;
        opacity: 0.6;
        pointer-events: none;
        user-select: none;
    }
    .hex :global(.colorPickerLabel) {
        flex-shrink: 0;
    }
    .colorPicker :global(.colorPickerLabel) {
        font-size: 12px;
        line-height: 1.4;
    }
    input {
        appearance: textfield;
        box-sizing: border-box;
        width: 100%;
        min-width: 0;
        padding: 6px;
        border: 1px solid var(--color-picker-border, #d1d6dd);
        border-radius: 4px;
        color: inherit;
        background: var(--color-picker-background, #fff);
        font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
        font-size: 13px;
        user-select: text;
    }
    input::-webkit-inner-spin-button, input::-webkit-outer-spin-button {
        appearance: none;
        margin: 0;
    }
    input.invalid {
        border-color: var(--color-picker-error, #c33);
    }
    .area:focus-visible, input:focus-visible, .colorPicker :global(.colorPickerThumb:focus-visible) {
        outline: 2px solid var(--color-picker-accent, #1e90ff);
        outline-offset: 3px;
    }
    .colorPicker[data-disabled] {
        opacity: 0.5;
    }
    .colorPicker[data-disabled] .area {
        cursor: default;
    }
    :global(html):has(.colorPicker.dragging), :global(html):has(.colorPicker.dragging) :global(*) {
        cursor: none !important;
    }
</style>


<script lang="ts">
    import { onDestroy, tick, untrack } from "svelte";
    import { Label, Slider } from "bits-ui";
    import { hexToHsla, hslaToCss, hslaToHex, normalizeHsla, type HslaColor } from "./color";

    type Channel = keyof HslaColor;
    type Props = {
        value: HslaColor;
        alpha?: boolean;
        disabled?: boolean;
        hexLabel?: string;
        anchor?: Element | null;
        onCloseRequest?: () => void;
        onValueChange?: (value: HslaColor) => void;
        onValueCommit?: (value: HslaColor) => void;
    };

    let {
        value = $bindable(), alpha = true, disabled = false, hexLabel = "Hex", anchor, onCloseRequest, onValueChange, onValueCommit
    }: Props = $props();
    const id = $props.id();
    const color = $derived(normalizeHsla(alpha ? value : { ...value, a: 1 }));
    const channels = $derived<Channel[]>(alpha ? ["h", "s", "l", "a"] : ["h", "s", "l"]);
    let area: HTMLDivElement;
    let areaPointer = $state<number | null>(null);
    let sliderPointer = $state<number | null>(null);
    let sliderSession = $state(0);
    let dirty = false;
    let emitted: HslaColor | null = null;
    let editing = $state<Channel | "hex" | null>(null);
    const drafts = $state<Record<Channel, string>>({ h: "", s: "", l: "", a: "" });
    let hexDraft = $state("");
    let hexEdited = false;

    $effect(() => {
        const current = color;
        if (emitted && !equal(current, emitted)) {
            dirty = false;
            emitted = null;
            editing = null;
            hexEdited = false;
        }
        for (const channel of channels) {
            if (channel !== editing) drafts[channel] = display(channel === "a" ? current.a * 100 : current[channel]);
        }
        if (editing !== "hex") hexDraft = hslaToHex(current, alpha).slice(1);
    });
    $effect(() => {
        if (disabled) untrack(() => finish(true));
    });
    $effect(() => {
        const target = anchor;
        const close = onCloseRequest;
        if (!target || !close) return;
        let active = true;
        const observer = new IntersectionObserver(entries => {
            const entry = entries.at(-1);
            if (!active || !entry || entry.isIntersecting) return;
            active = false;
            observer.disconnect();
            finish(true);
            close();
        }, { threshold: 0 });
        observer.observe(target);
        return () => {
            active = false;
            observer.disconnect();
        };
    });
    onDestroy(() => finish());

    function equal(left: HslaColor, right: HslaColor): boolean {
        return left.h === right.h && left.s === right.s && left.l === right.l && left.a === right.a;
    }

    function display(value: number): string {
        return value.toFixed(2);
    }

    function round(value: number): number {
        return Number(value.toFixed(2));
    }

    function maximum(channel: Channel): number {
        return channel === "h" ? 360 : 100;
    }

    function parse(channel: Channel): number | null {
        const text = drafts[channel].trim();
        const number = Number(text);
        return text && Number.isFinite(number) && number >= 0 && number <= maximum(channel) ? number : null;
    }

    function change(next: HslaColor): void {
        if (disabled) return;
        accept(next);
    }

    function accept(next: HslaColor): void {
        next = normalizeHsla(alpha ? next : { ...next, a: 1 });
        if (equal(next, color)) return;
        emitted = next;
        dirty = true;
        value = next;
        onValueChange?.({ ...next });
    }

    function changeChannel(channel: Channel, next: number): void {
        change({ ...color, [channel]: channel === "a" ? Number((round(next) / 100).toFixed(4)) : round(next) });
    }

    function commit(): void {
        if (!dirty) return;
        dirty = false;
        onValueCommit?.({ ...color });
    }

    function inputKeydown(event: KeyboardEvent, channel: Channel): void {
        if (disabled || event.isComposing || event.ctrlKey || event.altKey || event.metaKey) return;
        if (event.key === "Enter") {
            event.preventDefault();
            finish();
            return;
        }
        if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
        event.preventDefault();
        event.stopPropagation();
        const current = parse(channel) ?? (channel === "a" ? color.a * 100 : color[channel]);
        const step = event.shiftKey ? 0.1 : 0.01;
        changeChannel(channel, current + (event.key === "ArrowUp" ? step : -step));
        drafts[channel] = display(channel === "a" ? color.a * 100 : color[channel]);
        commit();
    }

    function sliderKeydown(event: KeyboardEvent, channel: "h" | "a"): void {
        if (disabled || event.isComposing || !event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return;
        let direction: number;
        switch (event.key) {
            case "ArrowRight": case "ArrowUp": direction = 1; break;
            case "ArrowLeft": case "ArrowDown": direction = -1; break;
            default: return;
        }
        event.preventDefault();
        event.stopPropagation();
        const current = channel === "a" ? color.a * 100 : color.h;
        changeChannel(channel, current + direction * 0.1);
        commit();
    }

    function startSlider(event: PointerEvent): void {
        if (!disabled && event.button === 0 && event.isPrimary) sliderPointer = event.pointerId;
    }

    function startArea(event: PointerEvent): void {
        if (disabled || event.button !== 0 || !event.isPrimary || areaPointer !== null) return;
        event.preventDefault();
        area.focus({ preventScroll: true });
        areaPointer = event.pointerId;
        area.setPointerCapture(event.pointerId);
        selectPoint(event);
    }

    function selectPoint(event: PointerEvent): void {
        const rect = area.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;
        change({ ...color, s: round((event.clientX - rect.left) / rect.width * 100), l: round(100 - (event.clientY - rect.top) / rect.height * 100) });
    }

    function moveArea(event: PointerEvent): void {
        if (event.pointerId === areaPointer) selectPoint(event);
    }

    function endArea(event: PointerEvent): void {
        if (event.pointerId !== areaPointer) return;
        selectPoint(event);
        finish();
    }

    function finishPointer(event: PointerEvent): void {
        if (event.pointerId === areaPointer || event.pointerId === sliderPointer) finish(event.type !== "pointerup");
    }

    function finish(cancelled = false): void {
        const next = hexEdited ? hexToHsla(`#${hexDraft.trim()}`) : null;
        hexEdited = false;
        if (next && (alpha || next.a === 1) && hslaToHex(next, alpha) !== hslaToHex(color, alpha)) accept(next);
        hexDraft = hslaToHex(color, alpha).slice(1);
        for (const channel of channels) drafts[channel] = display(channel === "a" ? color.a * 100 : color[channel]);
        editing = null;
        const previous = areaPointer;
        const sliding = sliderPointer !== null;
        areaPointer = null;
        sliderPointer = null;
        if (previous !== null && area?.hasPointerCapture(previous)) area.releasePointerCapture(previous);
        if (cancelled && sliding) {
            // Bits UI ends drags on pointerup/leave, but not pointercancel or window blur.
            const focused = document.activeElement?.id;
            sliderSession++;
            if (!disabled && (focused === `${id}-h-slider` || focused === `${id}-a-slider`)) {
                void tick().then(() => {
                    if (document.activeElement === document.body) document.getElementById(focused)?.focus({ preventScroll: true });
                });
            }
        }
        commit();
    }

    function areaKeydown(event: KeyboardEvent): void {
        if (disabled || event.isComposing || event.ctrlKey || event.altKey || event.metaKey) return;
        const step = event.shiftKey ? 0.1 : 0.01;
        let channel: "s" | "l";
        let next: number;
        switch (event.key) {
            case "ArrowLeft": channel = "s"; next = color.s - step; break;
            case "ArrowRight": channel = "s"; next = color.s + step; break;
            case "ArrowUp": channel = "l"; next = color.l + step; break;
            case "ArrowDown": channel = "l"; next = color.l - step; break;
            case "Home": channel = "s"; next = 0; break;
            case "End": channel = "s"; next = 100; break;
            case "PageUp": channel = "l"; next = color.l + 10; break;
            case "PageDown": channel = "l"; next = color.l - 10; break;
            default: return;
        }
        event.preventDefault();
        event.stopPropagation();
        changeChannel(channel, next);
        commit();
    }
</script>