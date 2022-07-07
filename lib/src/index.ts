import { API } from "pareto-validate-workspace-api";
import { getData } from "./getData";

import * as async from "pareto-async-functions-api"
import * as https from "pareto-https-api"
import * as fs from "pareto-filesystem-api"
import * as prcs from "pareto-process-api"

import { report } from "./report";

export function init(
    libs: {
        async: async.API,
        https: https.API,
        fs: fs.API,
        process: prcs.API,
    }
): API {
    return {
        getData: getData(libs),
        report: report()
    }
}