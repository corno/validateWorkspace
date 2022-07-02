import { init } from "./index"


const rootDir = process.argv[2]

if (rootDir === undefined) {
    throw new Error("Missing param")
}

const $ = init()

$.getData(
    rootDir,
    (msg) => {
        console.error(msg)
    }
).execute((res) => {
    $.report(
        res,
        console,
    )
})
