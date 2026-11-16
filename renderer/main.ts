import * as theme from "./theme";
import { mount, tick } from "svelte";
import App from "./components/layout/App.svelte";
import "./styles/base.css";
import "./styles/elements.css";
import "./styles/layouts.css";
import "./styles/colors.css";
import * as settingsAPI from "./states/settings";
import * as vocabularyAPI from "./states/vocabulary";
import * as settings from "./states/settings.svelte";
import * as dialogsAPI from "./states/dialogs";

document.documentElement.dataset.platform = window.api.platform;

// Apply the saved language and colors before mounting or showing the window.
const app = Promise.all([settingsAPI.initialize(), vocabularyAPI.initialize()]).then(async () => {
    const stopTheme = await theme.initialize();
    import.meta.hot?.dispose(stopTheme);
    const app = mount(App, { target: document.getElementById("app")! });
    if (settings.getSnapshot()?.loadError) dialogsAPI.show({ kind: "settings-load-failure" }, { revealWindow: false });
    await tick();
    window.api.ready();
    return app;
});

export default app;