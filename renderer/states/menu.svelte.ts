let active = $state("");

export function get(): string {
    return active;
}

export function set(value: string): void {
    active = value;
}