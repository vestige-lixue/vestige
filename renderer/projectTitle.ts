import { projectExtensionPattern } from "../shared/project/file";
import * as i18n from "./i18n.svelte";

export function projectTitle(fileName: string | null): string {
    return (fileName ?? i18n.t("project.unsaved.name")).replace(projectExtensionPattern, "");
}