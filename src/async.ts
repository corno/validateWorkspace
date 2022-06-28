
export type Async<T> = {
    execute: (
        callback: (v: T) => void
    ) => void
}