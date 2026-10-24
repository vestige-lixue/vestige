// Read text fragments instead of enclosing element boxes, which may span multiple lines.
export function textRectangles(root: HTMLElement, range: Range, includeBreaks = false): DOMRect[] {
    const result: DOMRect[] = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
        acceptNode: node => node.nodeType === Node.TEXT_NODE || includeBreaks && node instanceof HTMLBRElement
            && !node.classList.contains("ProseMirror-trailingBreak") ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP
    });
    walker.currentNode = range.startContainer.childNodes[range.startOffset] ?? range.startContainer;
    const textRange = document.createRange();
    let node = walker.currentNode.nodeType === Node.TEXT_NODE || includeBreaks && walker.currentNode instanceof HTMLBRElement
        ? walker.currentNode : walker.nextNode();
    while (node && range.comparePoint(node, 0) <= 0) {
        if (range.intersectsNode(node)) {
            if (node.nodeType === Node.TEXT_NODE) {
                textRange.setStart(node, node === range.startContainer ? range.startOffset : 0);
                textRange.setEnd(node, node === range.endContainer ? range.endOffset : node.textContent!.length);
            }
            else {
                const index = Array.prototype.indexOf.call(node.parentNode!.childNodes, node) as number;
                if (range.comparePoint(node.parentNode!, index) !== 0 || range.comparePoint(node.parentNode!, index + 1) !== 0) {
                    node = walker.nextNode();
                    continue;
                }
                textRange.selectNode(node);
            }
            for (let rect of textRange.getClientRects()) {
                if (includeBreaks && node instanceof HTMLBRElement && !node.classList.contains("ProseMirror-trailingBreak")) {
                    rect = new DOMRect(rect.x, rect.y, Math.max(rect.width, parseFloat(getComputedStyle(node).fontSize) / 2), rect.height);
                }
                if (rect.width < .5 || rect.height < .5) continue;
                const previous = result.at(-1);
                if (previous && Math.abs(previous.top - rect.top) < 1 && Math.abs(previous.bottom - rect.bottom) < 1
                    && rect.left <= previous.right + 1 && rect.right >= previous.left - 1) {
                    result[result.length - 1] = new DOMRect(Math.min(previous.left, rect.left), Math.min(previous.top, rect.top),
                        Math.max(previous.right, rect.right) - Math.min(previous.left, rect.left), Math.max(previous.bottom, rect.bottom) - Math.min(previous.top, rect.top));
                }
                else result.push(rect);
            }
        }
        node = walker.nextNode();
    }
    return result;
}