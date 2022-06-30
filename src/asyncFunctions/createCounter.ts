import { ICounter } from "./counter"
export function createCounter(
    callback: ($: ICounter) => void,
    onEnd: () => void,
) {
    let counter = 0
    let ended = false
    function wrapup() {
        if (counter === 0) {
            if (ended === true) {
                console.error("already ended")
            }
            ended = true
            onEnd()
        }
    }
    callback({
        increment: () => {
            if (ended) {
                console.error("async call done after context is ready")
            }
            counter += 1

        },
        decrement: () => {
            counter -= 1
            wrapup()
        },
    })
    wrapup()
}