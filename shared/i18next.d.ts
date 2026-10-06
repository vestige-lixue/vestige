import "i18next";
import { type default as translation } from "../locales/zh-CN.json";

declare module "i18next" {
    interface CustomTypeOptions {
        defaultNS: "translation";
        strictKeyChecks: true;
        enableSelector: false;
        resources: { translation: typeof translation };
    }
}