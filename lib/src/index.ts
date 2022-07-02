import { API } from "pareto-validate-workspace-api";
import { getData } from "./getData";

import * as async from "pareto-async-lib"
import * as https from "pareto-https-lib"
import * as fs from "pareto-filesystem-lib"
import * as prcs from "pareto-process-lib"
import { report } from "./report";

export function init(): API {
    return {
        getData: getData({
            fs: fs.init(async.init()),
            https: https.init(),
            async: async.init(),
            process: prcs.init(),

        }),
        report: report()
    }
}