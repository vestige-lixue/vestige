<svelte:window onpointerup={onpointerup} onpointercancel={onpointerup} onblur={stopDragging} />

<div
    class="handle"
    class:dragging
    bind:this={handle}
    tabindex="0"
    style:width={direction === "horizontal" ? "100%" : `${thickness}px`}
    style:height={direction === "vertical" ? "100%" : `${thickness}px`}
    style:cursor={direction === "horizontal" ? "ns-resize" : "ew-resize"}
    {onkeydown}
    {onpointerdown}
    {onpointermove}
    {onpointerup}
    onpointercancel={onpointerup}
    onlostpointercapture={onpointerup}
></div>
<div
    class="resizer-measurement-div"
    bind:this={measurement}
    style:width={direction === "vertical" ? toLength(origin) : "0px"}
    style:height={direction === "horizontal" ? toLength(origin) : "0px"}
    style:min-width={direction === "vertical" ? toLength(min) : undefined}
    style:max-width={direction === "vertical" ? toLength(max) : undefined}
    style:min-height={direction === "horizontal" ? toLength(min) : undefined}
    style:max-height={direction === "horizontal" ? toLength(max) : undefined}
></div>


<style>
    .handle {
        -webkit-app-region: no-drag;
        background-color: var(--c-border);
        outline: none;
        flex-grow: 0;
        flex-shrink: 0;
        touch-action: none;
    }
    .handle:hover, .handle:focus, .handle.dragging {
        background-color: var(--c-accent);
    }
    .resizer-measurement-div {
        position: absolute;
        top: 0;
        left: 0;
        visibility: hidden;
        pointer-events: none;
    }
</style>


<script lang="ts">
    type Props = {
        direction: "horizontal" | "vertical";
        thickness?: number;
        changeCB: (value: number) => void;
        origin: number | string;
        min?: number | string;
        max?: number | string;
    };

    const { direction, thickness = 5, changeCB, origin, min, max }: Props = $props();

    let handle: HTMLDivElement;
    let measurement: HTMLDivElement;
    let pointerId = $state<number | null>(null);
    const dragging = $derived(pointerId !== null);
    let dragStart = 0;
    let dragOrigin = 0;
    const dimension = $derived(direction === "horizontal" ? "height" : "width");

    function toLength(value: number | string | undefined): string | undefined {
        return typeof value === "number" ? `${value}px` : value;
    }

    function getPos(event: PointerEvent): number {
        return direction === "horizontal" ? event.clientY : event.clientX;
    }

    function onkeydown(event: KeyboardEvent): void {
        if (event.defaultPrevented || event.isComposing || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;
        const decreaseKey = direction === "vertical" ? "ArrowLeft" : "ArrowUp";
        const increaseKey = direction === "vertical" ? "ArrowRight" : "ArrowDown";
        if (event.key !== decreaseKey && event.key !== increaseKey) return;
        event.preventDefault();
        event.stopPropagation();
        measurement.style[dimension] = toLength(origin)!;
        const size = measurement.getBoundingClientRect()[dimension];
        measurement.style[dimension] = `${Math.max(0, size + (event.key === decreaseKey ? -1 : 1))}px`;
        changeCB(measurement.getBoundingClientRect()[dimension]);
    }

    function onpointerdown(event: PointerEvent): void {
        if (event.button !== 0 || !event.isPrimary) return;
        // A cancelled pending capture may never dispatch lostpointercapture.
        if (pointerId !== null && handle.hasPointerCapture(pointerId)) return;
        event.preventDefault();
        handle.setPointerCapture(event.pointerId);
        measurement.style[dimension] = toLength(origin)!;
        dragStart = getPos(event);
        dragOrigin = measurement.getBoundingClientRect()[dimension];
        pointerId = event.pointerId;
    }

    function onpointermove(event: PointerEvent): void {
        if (event.pointerId !== pointerId) return;
        if (!handle.hasPointerCapture(event.pointerId)) {
            stopDragging();
            return;
        }
        // CSS resolves relative units and min/max expressions against the current layout.
        measurement.style[dimension] = `${Math.max(0, dragOrigin + getPos(event) - dragStart)}px`;
        changeCB(measurement.getBoundingClientRect()[dimension]);
    }

    function onpointerup(event: PointerEvent): void {
        if (event.pointerId === pointerId) stopDragging();
    }

    function stopDragging(): void {
        const previous = pointerId;
        pointerId = null;
        if (previous !== null && handle.hasPointerCapture(previous)) handle.releasePointerCapture(previous);
    }
</script>