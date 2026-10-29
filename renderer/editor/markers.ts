import { type TranscriptInformation } from "./informationModel";

export function transcriptMarker(item: TranscriptInformation, options: { expanded?: boolean; label?: string; interactive?: boolean } = {}): HTMLElement {
    // Native buttons inside contenteditable distort Chromium's IME text offsets.
    const marker = document.createElement("span");
    if (options.interactive !== false) marker.tabIndex = 0;
    marker.className = `transcript-event ${item.kind} focusable${options.expanded ? " expanded" : ""}`;
    marker.dataset.inspection = item.key;
    if (item.kind === "deletion") {
        marker.setAttribute("role", "button");
        marker.setAttribute("aria-expanded", String(!!options.expanded));
        if (options.label) marker.setAttribute("aria-label", options.label);
    }
    const shape = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    shape.classList.add("transcript-event-shape");
    shape.setAttribute("viewBox", "0 0 10 10");
    shape.setAttribute("preserveAspectRatio", "none");
    // Cover the inner half of the stroke to preserve the triangle's filled size.
    for (const className of ["transcript-event-stroke", ""]) {
        const part = document.createElementNS("http://www.w3.org/2000/svg", "path");
        if (className) part.classList.add(className);
        part.setAttribute("d", "M0 0H10L5 10Z");
        shape.append(part);
    }
    marker.append(shape);
    return marker;
}

export function transcriptMarkerAnchor(marker: HTMLElement): HTMLElement {
    const anchor = document.createElement("span");
    anchor.className = "transcript-event-anchor";
    anchor.contentEditable = "false";
    const group = document.createElement("span");
    group.className = "transcript-events";
    group.append(marker);
    anchor.append(group);
    return anchor;
}