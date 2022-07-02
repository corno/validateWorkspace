import { init } from "pareto-validate-workspace-lib"

import * as pr from "pareto-runtime"


pr.runProgram(($$) => {

    const rootDir = $$.argument

    if (rootDir === undefined) {
        throw new Error("Missing param")
    }

    const $ = init()

    $.getData(
        rootDir,
        (msg) => {
            pr.logError(msg)
        }
    ).execute((res) => {
        $.report(
            res,
            {
                log: (msg) => {
                    pr.log(msg)
                }
            },
        )
    })

})
