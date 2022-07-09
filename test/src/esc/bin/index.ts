#!/usr/bin/env node

import { init } from "../../../../lib"

import * as pr from "pareto-runtime"

import * as https from "pareto-https-lib"
import * as async from "pareto-async-functions-lib"
import * as fs from "pareto-filesystem-lib"
import * as process from "pareto-process-lib"


pr.runProgram(($$) => {

    const rootDir = $$.argument

    if (rootDir === undefined) {
        throw new Error("Missing param")
    }

    const $ = init(
        {
            https: https.init(),
            async: async.init(),
            process: process.init(),
            fs: fs.init(),
        }
    )

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
