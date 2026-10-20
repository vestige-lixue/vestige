import * as theme from "./theme";
import { mount, tick } from "svelte";
import App from "./components/layout/App.svelte";
import "./styles/base.css";
import "./styles/elements.css";
import "./styles/layouts.css";
import "./styles/colors.css";
import * as settingsAPI from "./states/settings";

document.documentElement.dataset.platform = window.api.platform;

// Apply the saved language and colors before mounting or showing the window.
const app = settingsAPI.initialize().then(async () => {
    const stopTheme = await theme.initialize();
    import.meta.hot?.dispose(stopTheme);
    const app = mount(App, { target: document.getElementById("app")! });
    await tick();
    window.api.ready();
    return app;
});

export default app;