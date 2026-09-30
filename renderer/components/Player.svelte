<section>
    <div class="preview">
    </div>
    <div class="controls">
        <button type="button" disabled>播放</button>
        <input type="range" min="0" max="100" value="0" disabled />
        <span class="placeholder">00:00 / 00:00</span>
    </div>
</section>


<style>
    section {
        padding: 0 20px 16px;
        border-bottom: 1px solid var(--c-border);
    }
    .preview {
        display: grid;
        place-items: center;
        height: clamp(112px, 24vh, 200px);
        background: var(--c-surface);
    }
    .controls {
        display: flex;
        align-items: center;
        gap: 12px;
        padding-top: 12px;
    }
    .controls button {
        padding: 4px 12px;
    }
    .controls input {
        flex: 1;
        min-width: 0;
        margin: 0;
    }
    .controls span {
        white-space: nowrap;
        font-size: 12px;
        font-variant-numeric: tabular-nums;
    }
</style>