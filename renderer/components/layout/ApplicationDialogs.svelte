{#each dialogs.state.dialogs as current (current.id)}
    <DialogView {current} />
{/each}

<script lang="ts">
    import { untrack } from "svelte";
    import * as dialogs from "../../states/dialogs.svelte";
    import * as dialogsAPI from "../../states/dialogs";
    import DialogView from "./DialogView.svelte";

    const presented = new WeakSet<dialogs.ApplicationDialog>();
    $effect(() => {
        for (const current of [...dialogs.state.dialogs]) {
            if (current.parentId && !dialogs.state.dialogs.some(parent => parent.id === current.parentId)) {
                untrack(() => dialogsAPI.close(current.id));
            }
            if (current.open) presented.add(current);
            // A dialog closed before its first render has no animation to finish.
            else if (!presented.has(current)) untrack(() => dialogsAPI.remove(current.id));
        }
    });
</script>