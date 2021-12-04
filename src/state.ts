export interface State<A> {
    update(
        base: this | undefined,
        deltaTime: number,
        action: A | undefined,
        prevDeltaTime: number | undefined,
        prevBase: this | undefined
    ): void

    copyFrom(ref: this): void
}
