import { mount } from "svelte";
import App from "./components/layout/App.svelte";
import "./styles/base.css";
import "./styles/elements.css";
import "./styles/layouts.css";
import "./styles/colors.css";

document.documentElement.dataset.platform = window.api.platform;

const app = mount(App, {
    target: document.getElementById("app")!
});

export default app;