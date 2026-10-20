export type MediaReorderPreview = {
    mediaId: string;
    insertion: { beforeId: string | null; top: number; left: number; width: number } | null;
};

type Options = {
    ids: string[];
    disabled: boolean;
    onpreview: (preview: MediaReorderPreview | null) => void;
    onmove: (mediaId: string, beforeId: string | null) => void;
};

type Gesture = {
    pointerId: number;
    mediaId: string;
    startX: number;
    startY: number;
    x: number;
    y: number;
    dragging: boolean;
};

export function mediaReorder(list: HTMLElement, initial: Options): { update: (next: Options) => void; destroy: () => void } {
    const ownerWindow = list.ownerDocument.defaultView!;
    let options = initial;
    let gesture: Gesture | null = null;
    let preview: MediaReorderPreview | null = null;
    let suppressClick = false;
    let frame = 0;
    let lastFrameTime = 0;

    function show(next: MediaReorderPreview | null): void {
        if (preview?.mediaId === next?.mediaId && preview?.insertion?.beforeId === next?.insertion?.beforeId
            && preview?.insertion?.top === next?.insertion?.top && preview?.insertion?.left === next?.insertion?.left
            && preview?.insertion?.width === next?.insertion?.width) return;
        preview = next;
        options.onpreview(next);
    }

    function isInside(bounds: DOMRect): boolean {
        return gesture !== null && gesture.x >= bounds.left + list.clientLeft
            && gesture.x < bounds.left + list.clientLeft + list.clientWidth
            && gesture.y >= bounds.top + list.clientTop
            && gesture.y < bounds.top + list.clientTop + list.clientHeight;
    }

    function updatePreview(): void {
        if (!gesture?.dragging) return;
        const { mediaId, y } = gesture;
        const bounds = list.getBoundingClientRect();
        if (!isInside(bounds)) {
            show({ mediaId, insertion: null });
            return;
        }
        const rows = Array.from(list.children).filter((element): element is HTMLElement =>
            element instanceof HTMLElement && element.dataset.mediaId !== undefined && element.dataset.mediaId !== mediaId
        ).map(element => ({ id: element.dataset.mediaId!, rect: element.getBoundingClientRect() }));
        const before = rows.find(row => y < row.rect.top + row.rect.height / 2);
        const index = before ? rows.indexOf(before) : rows.length;
        if (!rows.length || index === options.ids.indexOf(mediaId)) {
            show({ mediaId, insertion: null });
            return;
        }
        const previous = rows[index - 1];
        const style = ownerWindow.getComputedStyle(list);
        const lineY = before ? previous ? (previous.rect.bottom + before.rect.top) / 2
            : before.rect.top - parseFloat(style.paddingTop) / 2
            : previous.rect.bottom + parseFloat(style.paddingBottom) / 2;
        const visibleTop = bounds.top + list.clientTop;
        const visibleY = Math.max(visibleTop + 1, Math.min(visibleTop + list.clientHeight - 1, lineY));
        const anchor = before ?? previous;
        show({
            mediaId,
            insertion: {
                beforeId: before?.id ?? null,
                top: visibleY - visibleTop + list.scrollTop - 1,
                left: anchor.rect.left - bounds.left - list.clientLeft + list.scrollLeft,
                width: anchor.rect.width
            }
        });
    }

    function animate(time: number): void {
        if (!gesture?.dragging) return;
        const elapsed = lastFrameTime ? Math.min(time - lastFrameTime, 32) : 0;
        lastFrameTime = time;
        const bounds = list.getBoundingClientRect();
        if (isInside(bounds)) {
            const top = bounds.top + list.clientTop;
            const bottom = top + list.clientHeight;
            const edge = Math.min(40, list.clientHeight / 4);
            const speed = gesture.y < top + edge ? -(top + edge - gesture.y) / edge
                : gesture.y > bottom - edge ? (gesture.y - bottom + edge) / edge : 0;
            if (speed) list.scrollBy({ top: speed * 500 * elapsed / 1000, behavior: "instant" });
        }
        // Recompute even when the pointer is still: scrolling and import progress can move rows.
        updatePreview();
        frame = ownerWindow.requestAnimationFrame(animate);
    }

    function cancel(): void {
        const previous = gesture;
        gesture = null;
        ownerWindow.cancelAnimationFrame(frame);
        frame = 0;
        lastFrameTime = 0;
        show(null);
        if (previous && list.hasPointerCapture(previous.pointerId)) list.releasePointerCapture(previous.pointerId);
    }

    function resetClick(event: PointerEvent): void {
        if (!event.isPrimary || event.button !== 0) return;
        cancel();
        suppressClick = false;
    }

    function start(event: PointerEvent): void {
        if (options.disabled || options.ids.length < 2 || event.defaultPrevented || !event.isPrimary || event.button !== 0
            || event.pointerType === "touch" || !(event.target instanceof Element)) return;
        const target = event.target;
        if (target.closest("button, input, textarea, select, a") || target.closest<HTMLElement>("[contenteditable]")?.isContentEditable) return;
        const row = target.closest<HTMLElement>("[data-media-id]");
        if (row?.parentElement !== list || !row.dataset.mediaId || !options.ids.includes(row.dataset.mediaId)) return;
        gesture = {
            pointerId: event.pointerId, mediaId: row.dataset.mediaId,
            startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY, dragging: false
        };
    }

    function move(event: PointerEvent): void {
        if (!gesture || event.pointerId !== gesture.pointerId) return;
        if (!(event.buttons & 1)) {
            cancel();
            return;
        }
        gesture.x = event.clientX;
        gesture.y = event.clientY;
        if (!gesture.dragging) {
            if (Math.hypot(gesture.x - gesture.startX, gesture.y - gesture.startY) < 6) return;
            gesture.dragging = true;
            suppressClick = true;
            list.setPointerCapture(event.pointerId);
            frame = ownerWindow.requestAnimationFrame(animate);
        }
        event.preventDefault();
        updatePreview();
    }

    function finish(event: PointerEvent): void {
        if (!gesture || event.pointerId !== gesture.pointerId) return;
        gesture.x = event.clientX;
        gesture.y = event.clientY;
        updatePreview();
        const mediaId = gesture.mediaId;
        const insertion = preview?.insertion;
        cancel();
        if (insertion && !options.disabled) options.onmove(mediaId, insertion.beforeId);
    }

    function cancelPointer(event: PointerEvent): void {
        if (gesture?.pointerId === event.pointerId) cancel();
    }

    function keydown(event: KeyboardEvent): void {
        if (!gesture || event.key !== "Escape") return;
        event.preventDefault();
        event.stopPropagation();
        cancel();
    }

    function click(event: MouseEvent): void {
        // Keep this until the next press, including after Escape or loss of pointer capture.
        // Keyboard activation has detail 0 and must remain available.
        if (!suppressClick || event.detail === 0) return;
        event.preventDefault();
        event.stopImmediatePropagation();
    }

    function nativeDrag(event: DragEvent): void {
        if (gesture) event.preventDefault();
    }

    list.addEventListener("pointerdown", start);
    list.addEventListener("lostpointercapture", cancelPointer);
    list.addEventListener("dragstart", nativeDrag);
    ownerWindow.addEventListener("pointerdown", resetClick, true);
    ownerWindow.addEventListener("pointermove", move, { passive: false });
    ownerWindow.addEventListener("pointerup", finish);
    ownerWindow.addEventListener("pointercancel", cancelPointer);
    ownerWindow.addEventListener("blur", cancel);
    ownerWindow.addEventListener("keydown", keydown, true);
    ownerWindow.addEventListener("click", click, true);
    ownerWindow.addEventListener("dblclick", click, true);

    return {
        update(next): void {
            const changed = options.ids.length !== next.ids.length || options.ids.some((id, index) => id !== next.ids[index]);
            options = next;
            if (next.disabled || changed) cancel();
        },
        destroy(): void {
            cancel();
            list.removeEventListener("pointerdown", start);
            list.removeEventListener("lostpointercapture", cancelPointer);
            list.removeEventListener("dragstart", nativeDrag);
            ownerWindow.removeEventListener("pointerdown", resetClick, true);
            ownerWindow.removeEventListener("pointermove", move);
            ownerWindow.removeEventListener("pointerup", finish);
            ownerWindow.removeEventListener("pointercancel", cancelPointer);
            ownerWindow.removeEventListener("blur", cancel);
            ownerWindow.removeEventListener("keydown", keydown, true);
            ownerWindow.removeEventListener("click", click, true);
            ownerWindow.removeEventListener("dblclick", click, true);
        }
    };
}