import { Async } from "./async";
import { createCounter } from "./createCounter";
import { createDictionary, IDictionary } from "./dictionary";

export function createDictionaryMapper<T, NT>(
    dictionary: IDictionary<T>,
    callback: (v: T, key: string) => Async<NT> | null
): Async<IDictionary<NT>> {
    return {
        execute: (cb) => {
            const temp: { [key: string]: NT } = {}
            createCounter(
                (counter) => {
                    dictionary.forEach((v, k) => {
                        counter.increment()
                        const tmp = callback(v, k)

                        if (tmp !== null) {

                            tmp.execute((v) => {
                                temp[k] = v
                                counter.decrement()
                            })
                        }
                    })
                },
                () => {
                    cb(createDictionary(temp))
                }
            )
        }
    }
}