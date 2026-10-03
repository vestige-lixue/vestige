class ModalLayers {
    #layers = $state<symbol[]>([]);

    open(layer: symbol): void {
        this.close(layer);
        this.#layers.push(layer);
    }

    close(layer: symbol): void {
        const index = this.#layers.indexOf(layer);
        if (index >= 0) this.#layers.splice(index, 1);
    }

    index(layer: symbol): number {
        return 12915 + Math.max(0, this.#layers.indexOf(layer)) * 2;
    }

    get top(): number {
        return 12915 + this.#layers.length * 2;
    }
}

export const modalLayers = new ModalLayers();