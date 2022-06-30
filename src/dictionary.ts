

export type IDictionary<T> = {
    forEach: (cb: (v: T, key: string) => void) => void
    map: <NT>(cb: (v: T, key: string) => NT) => IDictionary<NT>
    toArray: () => { key: string, value: T}[]
}

export function createDictionary<T>(source: { [key: string]: T }): IDictionary<T> {
    return {
        forEach: (cb) => {
            Object.keys(source).sort().forEach($ => {
                cb(source[$], $)
            })
        },
        map: <NT>(cb: (v: T, key: string) => NT) => {
            const target: { [key: string]: NT } = {}
            Object.keys(source).forEach($ => {
                target[$] = cb(source[$], $)
            })
            return createDictionary(target)
        },
        toArray: () => {
            return Object.keys(source).map($ => {
                return {
                    key: $,
                    value: source[$]
                }
            })
        }
    }
}
