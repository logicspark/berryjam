import { getSupportedFiles } from "../src/utils/file.utils";
import { existsSync, readFileSync, mkdirSync } from "fs";
import VueScanner from "../src";

let directory: string;
let ignorePatterns: string[];
let getSupportedFilesOutput: string[];
let checkNuxtExistsOutput: boolean;

beforeEach(() => {
	directory = `${__dirname}/example`.replace(/\\/g, "/");
	ignorePatterns = [];
	getSupportedFilesOutput = [];
	checkNuxtExistsOutput = false;
});

/**
 * To gather files that will be used for scanning.
 */
describe("Get supported files", () => {
	it("should be an array", async () => {
		const expected = Array;
		const received = await getSupportedFiles(directory, ignorePatterns);
		getSupportedFilesOutput = received;
		expect(received).toBeInstanceOf(expected);
	});

	it("should have an more than 0", async () => {
		const expected = 0;
		const received = await getSupportedFiles(directory, ignorePatterns);
		getSupportedFilesOutput = received;
		expect(received).not.toHaveLength(expected);
	});
});

/**
 * To check if .nuxt folder exists. The .nuxt folder is important for finding Vue components in Nuxt projects.
 */
describe("The .Nuxt folder exists", () => {
	it("should be false", () => {
		const nuxtPath = `${directory}/.nuxt`;
		const expected = false;
		const received = existsSync(nuxtPath);
		checkNuxtExistsOutput = received;
		expect(received).toBe(expected);
	});
});

/**
 * To find and group to determine components’ sources origins.
 * Find the nearest package.json file to retrieve its directory.
 */
describe("Trace files to respective package.json files", () => {
	it("should be null", async () => {
		console.log("directory", directory);
		const vueScanner = new VueScanner(directory, { appDir: directory });
		const expected = null;
		const received = await vueScanner.traceFilesToPackageJson();
		expect(received).toBe(expected);
	});
});

/**
 * To gather all JS and TS config files with respect to each package.json which will be used to map later.
 */
describe("Find JS and TS config files", () => {
	//PackageGroup[]
	it("should be an array", async () => {
		const vueScanner = new VueScanner(directory, { appDir: directory });
		const expected = null;
		const mappedFilesPackage =
			(await vueScanner.traceFilesToPackageJson()) ?? {};
		const received = await vueScanner.findCodeConfig(mappedFilesPackage);
		expect(received).toBeInstanceOf(Array);
	});
});
