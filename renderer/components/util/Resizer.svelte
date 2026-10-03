<div
    class="handle"
    class:dragging
    style:width={direction === "horizontal" ? "100%" : `${thickness}px`}
    style:height={direction === "vertical" ? "100%" : `${thickness}px`}
    style:cursor={direction === "horizontal" ? "ns-resize" : "ew-resize"}
    {onpointerdown}
    {onpointermove}
    {onpointerup}
    onpointercancel={onpointerup}
    onlostpointercapture={() => dragging = false}
></div>
<div
    class="measurement"
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
        flex-grow: 0;
        flex-shrink: 0;
        touch-action: none;
    }
    .handle:hover, .handle.dragging {
        background-color: var(--c-accent);
    }
    .measurement {
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

    let measurement: HTMLDivElement;
    let dragging = $state(false);
    let dragStart = 0;
    let dragOrigin = 0;
    const dimension = $derived(direction === "horizontal" ? "height" : "width");

    function toLength(value: number | string | undefined): string | undefined {
        return typeof value === "number" ? `${value}px` : value;
    }

    function getPos(event: PointerEvent): number {
        return direction === "horizontal" ? event.clientY : event.clientX;
    }

    function onpointerdown(event: PointerEvent): void {
        if (event.button !== 0 || !event.isPrimary || dragging) return;
        const handle = event.currentTarget as HTMLDivElement;
        event.preventDefault();
        handle.setPointerCapture(event.pointerId);
        measurement.style[dimension] = toLength(origin)!;
        dragStart = getPos(event);
        dragOrigin = measurement.getBoundingClientRect()[dimension];
        dragging = true;
    }

    function onpointermove(event: PointerEvent): void {
        const handle = event.currentTarget as HTMLDivElement;
        if (!handle.hasPointerCapture(event.pointerId)) return;
        // CSS resolves relative units and min/max expressions against the current layout.
        measurement.style[dimension] = `${Math.max(0, dragOrigin + getPos(event) - dragStart)}px`;
        changeCB(measurement.getBoundingClientRect()[dimension]);
    }

    function onpointerup(event: PointerEvent): void {
        const handle = event.currentTarget as HTMLDivElement;
        if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
    }
</script>