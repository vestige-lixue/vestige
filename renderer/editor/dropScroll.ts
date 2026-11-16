import { type EditorView } from "@tiptap/pm/view";
import { type DropPointer } from "./drop";
import { markAutomaticTranscriptScroll } from "./scrollInput";

const edgeSize = 64;
const startDelay = 100;
const minimumSpeed = 120;
const maximumSpeed = 2400;

export function attachDropScroll(view: EditorView, refresh: () => void): { update: (point?: DropPointer) => void; destroy: () => void } {
    const scroll = view.dom.closest<HTMLElement>(".transcript-scroll");
    const owner = view.dom.ownerDocument.defaultView!;
    let pointer: DropPointer | undefined;
    let frame = 0, direction = 0, entered = 0, previous = 0;
    let position = 0, applied = 0;

    function velocity(): number {
        if (!scroll || !pointer || !view.editable) return 0;
        const rect = scroll.getBoundingClientRect();
        const top = Math.max(0, rect.top + scroll.clientTop), bottom = Math.min(owner.innerHeight, rect.top + scroll.clientTop + scroll.clientHeight);
        if (pointer.left < rect.left || pointer.left >= rect.right || pointer.top < top || pointer.top >= bottom) return 0;
        const edge = Math.min(edgeSize, (bottom - top) / 2);
        const distance = Math.min(pointer.top - top, bottom - pointer.top);
        if (edge <= 0 || distance >= edge) return 0;
        const depth = 1 - distance / edge;
        return (pointer.top < (top + bottom) / 2 ? -1 : 1) * (minimumSpeed + (maximumSpeed - minimumSpeed) * depth * depth);
    }

    function write(top: number): void {
        markAutomaticTranscriptScroll(view, top);
        scroll!.scrollTo({ top, behavior: "instant" });
        applied = scroll!.scrollTop;
    }

    function tick(now: number): void {
        frame = 0;
        const speed = velocity(), next = Math.sign(speed);
        if (!next || !scroll) {
            direction = 0;
            return;
        }
        if (next !== direction) {
            direction = next;
            entered = now;
            previous = now + startDelay;
            position = applied = scroll.scrollTop;
        }
        if (now >= entered + startDelay) {
            const elapsed = Math.min(50, Math.max(0, now - previous));
            previous = now;
            position = Math.max(0, Math.min(scroll.scrollHeight - scroll.clientHeight, position + speed * elapsed / 1000));
            write(position);
            refresh();
        }
        frame = owner.requestAnimationFrame(tick);
    }

    function update(point?: DropPointer): void {
        pointer = point;
        if (!velocity()) {
            owner.cancelAnimationFrame(frame);
            frame = direction = 0;
            if (scroll) position = applied = scroll.scrollTop;
        }
        else if (!frame) tick(owner.performance.now());
    }

    function scrolled(): void {
        // Chromium also scrolls in its narrower native drag belt. Own the absolute
        // position throughout the drag, including residual scroll after leaving the belt.
        if (pointer && view.editable && scroll && scroll.scrollTop !== applied) write(applied);
        if (pointer) refresh();
    }
    scroll?.addEventListener("scroll", scrolled, { passive: true });
    return {
        update,
        destroy() {
            update();
            scroll?.removeEventListener("scroll", scrolled);
        }
    };
}