{#if editing && editable}
    <div
        class={["editor", className]}
        bind:this={element}
        bind:innerText={draft}
        contenteditable="plaintext-only"
        onblur={event => {
            if (!isMenuTarget(event.relatedTarget) && event.currentTarget.ownerDocument.hasFocus()) finishEditing();
        }}
        onkeydown={handleKeydown}
    ></div>
{:else}
    <div
        {...labelAttributes}
        class={["label", className]}
        class:focusable={tabIndex !== undefined}
        class:scrolling={scrollDistance > 0 && scrollDuration > 0}
        bind:this={element}
        contenteditable="false"
        tabindex={tabIndex}
        style:--scroll-distance={`${scrollDistance}px`}
        style:--scroll-duration={`${scrollAnimationDuration}s`}
        style:--scroll-stop={`${scrollStop}s`}
        style:--scroll-stop-progress={`${scrollStopProgress}%`}
    >
        <span bind:this={text}>{value}</span>
    </div>
{/if}


<style>
    div {
        width: 100%;
        min-width: 0;
        min-height: 1lh;
        overflow: hidden;
        color: inherit;
        white-space: nowrap;
        scroll-behavior: auto;
    }
    .label {
        user-select: none;
    }
    .label:focus-visible {
        border-radius: 4px;
    }
    .label span {
        display: block;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .scrolling span {
        width: max-content;
        animation: scroll-label var(--scroll-duration) calc(var(--scroll-stop) / 2)
            linear(0 0% var(--scroll-stop-progress), 1 calc(100% - var(--scroll-stop-progress)) 100%)
            infinite alternate;
    }
    .editor {
        cursor: text;
        user-select: text;
        border-radius: 4px;
        outline: 2px solid var(--c-accent);
        outline-offset: 3px;
    }
    @keyframes scroll-label {
        0% {
            transform: translateX(0);
        }
        100% {
            transform: translateX(calc(-1 * var(--scroll-distance)));
        }
    }
    @media (prefers-reduced-motion: reduce) {
        .scrolling span {
            width: auto;
            animation: none;
        }
    }
</style>


<script lang="ts">
    import { mergeProps } from "bits-ui";
    import { tick } from "svelte";
    import { type HTMLAttributes } from "svelte/elements";

    type Props = Omit<HTMLAttributes<HTMLDivElement>, "onchange"> & {
        value: string;
        editable: boolean;
        onchange: (value: string) => void;
        scrollMode?: "none" | "ontime" | "onspeed";
        // Seconds for ontime, pixels per second for onspeed.
        scrollParam?: number;
        // Seconds to pause at either endpoint.
        scrollPause?: number;
    };

    let { class: className = "", value, onchange, editable, scrollMode = "none", scrollParam = 1, scrollPause = 1, ...labelProps }: Props = $props();

    let element = $state<HTMLDivElement>();
    let text = $state<HTMLSpanElement>();
    let draft = $state("");
    let editing = $state(false);
    let scrollDistance = $state(0);
    const tabIndex = $derived(labelProps.tabindex ?? (editable ? 0 : undefined));
    const labelAttributes = $derived(mergeProps(labelProps, {
        ondblclick: editable ? startEditing : undefined,
        onkeydown: handleKeydown,
        onmouseenter: startScrolling,
        onmouseleave: stopScrolling,
        onfocus: startScrolling,
        onblur: stopScrolling
    }));
    const scrollDuration = $derived.by(() => {
        if (scrollMode === "none" || !Number.isFinite(scrollParam) || scrollParam <= 0) return 0;
        return scrollMode === "ontime" ? scrollParam : scrollDistance / scrollParam;
    });
    const scrollStop = $derived(Number.isFinite(scrollPause) ? Math.max(0, scrollPause) : 0);
    const scrollAnimationDuration = $derived(scrollDuration + scrollStop);
    // Alternating directions each supply half of the pause at their shared endpoint.
    const scrollStopProgress = $derived(scrollAnimationDuration > 0 ? scrollStop / scrollAnimationDuration * 50 : 0);

    $effect(() => {
        if (editing && !editable) editing = false;
        // External updates must not replace an active draft or move the caret.
        if (!editing) {
            draft = value;
            scrollDistance = 0;
        }
    });

    $effect(() => {
        if (!editing || !element) return;
        const editor = element;
        const ownerDocument = editor.ownerDocument;
        let dragging = false;
        let anchor: { node: Node; offset: number } | undefined;

        function startDrag(event: MouseEvent): void {
            dragging = event.button === 0 && event.detail === 1;
            anchor = undefined;
        }

        function rememberAnchor(event: MouseEvent): void {
            if (!dragging) return;
            if (!(event.buttons & 1)) {
                endDrag();
                return;
            }
            if (anchor) return;
            // Mousedown has placed the native caret before the first mousemove.
            const selection = ownerDocument.getSelection();
            if (selection?.anchorNode && editor.contains(selection.anchorNode)) {
                anchor = { node: selection.anchorNode, offset: selection.anchorOffset };
            }
        }

        function followSelection(): void {
            const selection = ownerDocument.getSelection();
            if (anchor && selection?.focusNode && editor.contains(selection.focusNode)
                && (selection.anchorNode !== anchor.node || selection.anchorOffset !== anchor.offset)) {
                // Scrolling can make Chromium collapse a reversing drag and replace its anchor.
                selection.setBaseAndExtent(anchor.node, anchor.offset, selection.focusNode, selection.focusOffset);
            }
            scrollSelectionFocusIntoView();
        }

        function endDrag(): void {
            followSelection();
            dragging = false;
            anchor = undefined;
        }

        function finishOutside(event: Event): void {
            if (event.target instanceof Node && !editor.contains(event.target) && !isMenuTarget(event.target) && ownerDocument.hasFocus()) finishEditing();
        }

        editor.addEventListener("mousedown", startDrag);
        ownerDocument.addEventListener("pointerdown", finishOutside);
        ownerDocument.addEventListener("focusin", finishOutside);
        ownerDocument.addEventListener("mousemove", rememberAnchor);
        ownerDocument.addEventListener("mouseup", endDrag);
        ownerDocument.defaultView?.addEventListener("blur", endDrag);
        ownerDocument.addEventListener("selectionchange", followSelection);
        return () => {
            editor.removeEventListener("mousedown", startDrag);
            ownerDocument.removeEventListener("pointerdown", finishOutside);
            ownerDocument.removeEventListener("focusin", finishOutside);
            ownerDocument.removeEventListener("mousemove", rememberAnchor);
            ownerDocument.removeEventListener("mouseup", endDrag);
            ownerDocument.defaultView?.removeEventListener("blur", endDrag);
            ownerDocument.removeEventListener("selectionchange", followSelection);
        };
    });

    function isMenuTarget(target: EventTarget | null): boolean {
        return target instanceof Element && target.closest("[data-menubar-trigger], [data-menubar-content]") !== null;
    }

    async function startEditing(event: MouseEvent | KeyboardEvent): Promise<void> {
        if (!editable) return;
        event.preventDefault();
        event.stopPropagation();
        element?.blur();
        draft = value;
        scrollDistance = 0;
        editing = true;
        await tick();
        if (!editing || !editable || !element) return;
        element.focus();
        element.ownerDocument.getSelection()?.selectAllChildren(element);
    }

    function startScrolling(): void {
        if (!element || !text) return;
        scrollDistance = Math.max(0, text.scrollWidth - element.clientWidth);
    }

    function stopScrolling(): void {
        if (!element?.matches(":hover, :focus")) scrollDistance = 0;
    }

    function scrollSelectionFocusIntoView(): void {
        if (!editing || !element || element.ownerDocument.activeElement !== element) return;
        const selection = element.ownerDocument.getSelection();
        if (!selection?.focusNode || !element.contains(selection.anchorNode) || !element.contains(selection.focusNode)) return;
        const range = element.ownerDocument.createRange();
        range.setStart(selection.focusNode, selection.focusOffset);
        range.collapse(true);
        const focus = range.getClientRects()[0];
        if (!focus) return;
        const left = element.getBoundingClientRect().left + element.clientLeft;
        const right = left + element.clientWidth;
        if (focus.left < left) element.scrollLeft += focus.left - left;
        else if (focus.right > right) element.scrollLeft += focus.right - right;
    }

    async function finishEditing(cancel = false): Promise<void> {
        if (!element) return;
        const selection = element.ownerDocument.getSelection();
        if (selection && element.contains(selection.anchorNode) && element.contains(selection.focusNode)) {
            selection.removeAllRanges();
        }
        if (!editing) return;
        const nextValue = draft.replace(/[\r\n\u2028\u2029]+/g, " ").trim();
        editing = false;
        if (!cancel && editable && nextValue && nextValue !== value) onchange(nextValue);
        draft = value;
        element?.blur();
        await tick();
        if (!editing && editable) element?.focus();
    }

    function handleKeydown(event: KeyboardEvent): void {
        if (event.isComposing || event.repeat) return;
        if (!editing) {
            if (editable && event.key === "Enter") void startEditing(event);
            return;
        }
        if (event.key !== "Enter" && event.key !== "Escape") return;
        event.preventDefault();
        event.stopPropagation();
        void finishEditing(event.key === "Escape");
    }
</script>