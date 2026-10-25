<View {...presentation.props} bind:open={() => current.open, value => dialogsAPI.setOpen(current.id, value)} onClosed={closed} />

<script lang="ts">
    import { setContext } from "svelte";
    import * as dialogs from "../../states/dialogs.svelte";
    import * as dialogsAPI from "../../states/dialogs";
    import { dialogLifecycleKey, type DialogLifecycle } from "../dialogs/lifecycle";
    import { presentDialog } from "./dialogRegistry";

    const { current }: { current: dialogs.ApplicationDialog } = $props();
    const presentation = $derived(presentDialog(current));
    const View = $derived(presentation.component);
    setContext<DialogLifecycle>(dialogLifecycleKey, {
        closed: () => dialogsAPI.remove(current.id), closeRejected: () => dialogsAPI.rejectClose(current.id)
    });

    function closed(next?: () => void): void {
        if (current.open || !dialogs.state.dialogs.includes(current)) return;
        dialogsAPI.remove(current.id);
        next?.();
    }
</script>