import { getData } from "./getData"
import { report } from "./report"


const rootDir = process.argv[2]

if (rootDir === undefined) {
    throw new Error("Missing param")
}

getData(rootDir).execute((res) => {
    report(res)
})
