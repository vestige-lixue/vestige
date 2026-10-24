// Persistent AVL rope. Source coordinates never move; displayed offsets are subtree sums.
export type Piece = {
    kind: "segment" | "insert" | "delete";
    index: number;
    sourceFrom: number;
    sourceTo: number;
    text: string;
};

type Leaf = Piece & { height: 1; length: number; width: number };
type Branch = {
    left: PieceTree;
    right: PieceTree;
    height: number;
    length: number;
    width: number;
    sourceFrom: number;
    sourceTo: number;
};
export type PieceTree = Leaf | Branch;
export type LocatedPiece = Piece & { from: number; to: number; utf16From: number; utf16To: number };

function branch(left: PieceTree, right: PieceTree): Branch {
    return {
        left, right, height: Math.max(left.height, right.height) + 1,
        length: left.length + right.length, width: left.width + right.width,
        sourceFrom: left.sourceFrom, sourceTo: right.sourceTo
    };
}

function balance(left: PieceTree, right: PieceTree): PieceTree {
    if (left.height > right.height + 1 && "left" in left) {
        if (left.left.height >= left.right.height) return branch(left.left, branch(left.right, right));
        if ("left" in left.right) return branch(branch(left.left, left.right.left), branch(left.right.right, right));
    }
    if (right.height > left.height + 1 && "left" in right) {
        if (right.right.height >= right.left.height) return branch(branch(left, right.left), right.right);
        if ("left" in right.left) return branch(branch(left, right.left.left), branch(right.left.right, right.right));
    }
    return branch(left, right);
}

function join(left: PieceTree | null, right: PieceTree | null): PieceTree | null {
    if (!left) return right;
    if (!right) return left;
    if (left.height > right.height + 1 && "left" in left) return balance(left.left, join(left.right, right)!);
    if (right.height > left.height + 1 && "left" in right) return balance(join(left, right.left)!, right.right);
    return branch(left, right);
}

function leaf(piece: Piece): Leaf {
    return { ...piece, height: 1, length: Array.from(piece.text).length, width: piece.text.length };
}

export function pieceTree(pieces: Piece[], from = 0, to = pieces.length): PieceTree | null {
    if (from === to) return null;
    if (to - from === 1) return leaf(pieces[from]);
    const middle = (from + to) >>> 1;
    return branch(pieceTree(pieces, from, middle)!, pieceTree(pieces, middle, to)!);
}

function boundary(tree: PieceTree, end: boolean): Leaf {
    while ("left" in tree) tree = end ? tree.right : tree.left;
    return tree;
}

function withoutBoundary(tree: PieceTree, end: boolean): PieceTree | null {
    if (!("left" in tree)) return null;
    return end ? join(tree.left, withoutBoundary(tree.right, true)) : join(withoutBoundary(tree.left, false), tree.right);
}

export function concatPieces(left: PieceTree | null, right: PieceTree | null): PieceTree | null {
    if (!left || !right) return left ?? right;
    const before = boundary(left, true);
    const after = boundary(right, false);
    if (before.kind === after.kind && before.index === after.index && before.sourceTo === after.sourceFrom) {
        const combined = leaf({ ...before, sourceTo: after.sourceTo, text: before.text + after.text });
        return join(join(withoutBoundary(left, true), combined), withoutBoundary(right, false));
    }
    return join(left, right);
}

function utf16Offset(text: string, codepoints: number): number {
    let offset = 0;
    for (const character of text) {
        if (codepoints-- === 0) break;
        offset += character.length;
    }
    return offset;
}

export function splitPieces(tree: PieceTree | null, source: number, includeInsertion: boolean): [PieceTree | null, PieceTree | null] {
    if (!tree) return [null, null];
    if (tree.sourceTo < source) return [tree, null];
    if (tree.sourceFrom > source) return [null, tree];
    if ("left" in tree) {
        const [left, middleLeft] = splitPieces(tree.left, source, includeInsertion);
        const [middleRight, right] = splitPieces(tree.right, source, includeInsertion);
        return [join(left, middleRight), join(middleLeft, right)];
    }
    if (tree.kind === "insert") return tree.sourceFrom < source || tree.sourceFrom === source && includeInsertion ? [tree, null] : [null, tree];
    if (tree.sourceTo <= source) return [tree, null];
    if (tree.sourceFrom >= source) return [null, tree];
    const offset = tree.kind === "segment" ? utf16Offset(tree.text, source - tree.sourceFrom) : 0;
    return [leaf({ ...tree, sourceTo: source, text: tree.text.slice(0, offset) }), leaf({ ...tree, sourceFrom: source, text: tree.text.slice(offset) })];
}

// Inclusive endpoints also expose zero-width deletions and the neighbors of an insertion.
export function* displayedPieces(tree: PieceTree | null, from = 0, to = Infinity, utf16 = false, start = 0, width = 0): Generator<LocatedPiece> {
    if (!tree || (utf16 ? width + tree.width < from || width > to : start + tree.length < from || start > to)) return;
    if ("left" in tree) {
        yield* displayedPieces(tree.left, from, to, utf16, start, width);
        yield* displayedPieces(tree.right, from, to, utf16, start + tree.left.length, width + tree.left.width);
    }
    else yield { ...tree, from: start, to: start + tree.length, utf16From: width, utf16To: width + tree.width };
}

export function* sourcePieces(tree: PieceTree | null, from: number, to: number, start = 0, width = 0): Generator<LocatedPiece> {
    if (!tree || tree.sourceTo < from || tree.sourceFrom > to) return;
    if ("left" in tree) {
        yield* sourcePieces(tree.left, from, to, start, width);
        yield* sourcePieces(tree.right, from, to, start + tree.left.length, width + tree.left.width);
    }
    else yield { ...tree, from: start, to: start + tree.length, utf16From: width, utf16To: width + tree.width };
}

export function displayedOffset(tree: PieceTree | null, source: number): number {
    if (!tree || tree.sourceTo <= source) return tree?.width ?? 0;
    if ("left" in tree) return tree.left.sourceTo <= source ? tree.left.width + displayedOffset(tree.right, source) : displayedOffset(tree.left, source);
    return tree.kind === "segment" ? utf16Offset(tree.text, Math.max(0, source - tree.sourceFrom)) : 0;
}

export function convertOffset(tree: PieceTree | null, offset: number, toUtf16: boolean): number {
    const length = toUtf16 ? tree?.length ?? 0 : tree?.width ?? 0;
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > length) throw new RangeError("Invalid displayed text offset.");
    if (!tree) return 0;
    if ("left" in tree) {
        const leftLength = toUtf16 ? tree.left.length : tree.left.width;
        if (offset <= leftLength) return convertOffset(tree.left, offset, toUtf16);
        return (toUtf16 ? tree.left.width : tree.left.length) + convertOffset(tree.right, offset - leftLength, toUtf16);
    }
    if (toUtf16) return utf16Offset(tree.text, offset);
    let width = 0;
    let count = 0;
    for (const character of tree.text) {
        if (width === offset) return count;
        width += character.length;
        count++;
        if (width > offset) throw new RangeError("Position splits a codepoint.");
    }
    return count;
}