let active = $state<string | symbol>("");

// Bits UI's menubar only accepts string values; popover menus use their own identity.
export function get(): string {
    return typeof active === "string" ? active : "";
}

export function set(value: string): void {
    if (value || typeof active === "string") active = value;
}

export function isOpen(owner?: symbol): boolean {
    return owner === undefined ? active !== "" : active === owner;
}

export function open(owner: symbol): void {
    active = owner;
}

export function close(owner?: symbol): void {
    if (owner === undefined || active === owner) active = "";
}