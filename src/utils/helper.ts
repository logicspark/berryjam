import * as TextUtils from "./text.utils";
import * as FileUtils from "./file.utils";

const rootPath = require("app-root-path");
const packageJson = require(`${rootPath}/package.json`);

const APP_NAME = `${packageJson?.name ?? "berryjam"}`;
const APP_DIR = APP_NAME.split("/").join("-");
const APP_VERSION = `${packageJson?.version ?? "0.0.1"}`;

export { TextUtils, FileUtils, APP_NAME, APP_VERSION, APP_DIR };
