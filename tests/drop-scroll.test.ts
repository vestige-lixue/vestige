import { describe, expect, it } from "vitest";
import { type EditorView } from "@tiptap/pm/view";
import { attachDropScroll } from "../renderer/editor/dropScroll";

function fixture(): {
    scroll: { scrollTop: number };
    control: ReturnType<typeof attachDropScroll>;
    tick: (time: number) => void;
    nativeScroll: (top: number) => void;
    pending: () => number;
} {
    let now = 0, sequence = 0;
    const frames = new Map<number, FrameRequestCallback>();
    let listener: (() => void) | undefined;
    const scroll = {
        scrollTop: 3000, scrollHeight: 10000, clientHeight: 600, clientTop: 0,
        getBoundingClientRect: () => ({ left: 0, right: 800, top: 0, bottom: 600 }),
        scrollTo: ({ top }: { top: number }) => scroll.scrollTop = Math.round(top),
        addEventListener: (_type: string, callback: () => void) => listener = callback,
        removeEventListener: () => listener = undefined
    };
    const view = {
        editable: true,
        dom: {
            closest: () => scroll,
            ownerDocument: { defaultView: {
                innerHeight: 800, performance: { now: () => now },
                requestAnimationFrame: (callback: FrameRequestCallback) => {
                    frames.set(++sequence, callback);
                    return sequence;
                },
                cancelAnimationFrame: (id: number) => frames.delete(id)
            } }
        }
    } as unknown as EditorView;
    return {
        scroll, control: attachDropScroll(view, () => {}),
        tick(time) {
            now = time;
            const callbacks = [...frames.values()];
            frames.clear();
            for (const callback of callbacks) callback(time);
        },
        nativeScroll(top) {
            scroll.scrollTop = top;
            listener?.();
        },
        pending: () => frames.size
    };
}

describe("drop autoscroll", () => {
    it.each([60, 120, 144])("keeps speed independent of a %iHz refresh rate", rate => {
        const value = fixture();
        value.control.update({ left: 400, top: 584 });
        for (let time = 1000 / rate; time < 1100; time += 1000 / rate) value.tick(time);
        value.tick(1100);
        expect(Math.abs(value.scroll.scrollTop - 4402.5)).toBeLessThanOrEqual(0.5);
        value.control.destroy();
        expect(value.pending()).toBe(0);
    });

    it("waits 100ms, then prevents native scroll from adding to its speed", () => {
        const value = fixture();
        value.control.update({ left: 400, top: 16 });
        value.tick(99);
        expect(value.scroll.scrollTop).toBe(3000);
        value.tick(100);
        value.tick(150);
        expect(value.scroll.scrollTop).toBe(2930);
        value.nativeScroll(2900);
        expect(value.scroll.scrollTop).toBe(2930);
        value.control.destroy();
    });

    it("stops on leaving the hot zone or ending a drag", () => {
        const value = fixture();
        value.control.update({ left: 400, top: 536 });
        expect(value.pending()).toBe(0);
        value.control.update({ left: 400, top: 580 });
        expect(value.pending()).toBe(1);
        value.control.update({ left: 400, top: 300 });
        expect(value.pending()).toBe(0);
        value.nativeScroll(3100);
        expect(value.scroll.scrollTop).toBe(3000);
        value.control.update({ left: 400, top: 20 });
        value.control.update();
        expect(value.pending()).toBe(0);
        value.nativeScroll(3100);
        expect(value.scroll.scrollTop).toBe(3100);
        value.control.destroy();
    });

    it("does not jump after a suspended frame", () => {
        const value = fixture();
        value.control.update({ left: 400, top: 0 });
        value.tick(100);
        value.tick(5000);
        expect(value.scroll.scrollTop).toBe(2880);
        value.control.destroy();
    });
});