import * as config from "./states/config.svelte";
import { mount } from "svelte";
import App from "./components/layout/App.svelte";
import "./styles/base.css";
import "./styles/elements.css";
import "./styles/layouts.css";
import "./styles/colors.css";

document.documentElement.dataset.platform = window.api.platform;

// Load the saved language before the first render, avoiding a flash of the default language.
const app = config.initialize().then(() => mount(App, {
    target: document.getElementById("app")!
}));

export default app;