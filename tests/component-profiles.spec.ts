import { existsSync, readFileSync } from "fs";
import VueScanner from "../src";
import { ComponentProfile } from "../src/types";

const componentProfiles = require("./example/components.json");

function isComponentProfile(obj: any): obj is ComponentProfile {
	return typeof obj === "object" &&
		"name" in obj &&
		"type" in obj &&
		typeof obj.name === "string" &&
		obj.type
		? typeof obj.type === "string"
		: obj.type === null;
}
describe("The type of result must be ComponentProfile[]", () => {
	it("should be an array of object", async () => {
		console.log(typeof componentProfiles);
		expect(componentProfiles).toBeInstanceOf(Object);
		expect(Array.isArray(componentProfiles)).toBeTruthy();
	});
	componentProfiles.forEach((componentProfile) => {
		test(`typeof componentProfile must be ComponentProfile `, () => {
			expect(isComponentProfile(componentProfile)).toBeTruthy();
		});
	});
});

describe("The output must be written as json format", () => {
	const directory = `${__dirname}/example`.replace(/\\/g, "/");
	const appDir = `${directory}/.test`;
	const vueScanner = new VueScanner(directory, {
		appDir,
	});
	it("should return an existing json path", async () => {
		await vueScanner
			.writeComponentProfilesToJson(componentProfiles)
			.then((pathOfFile) => {
				expect(existsSync(pathOfFile)).toBeTruthy();
				const rawJson = readFileSync(pathOfFile, "utf8");
				expect(JSON.parse(rawJson).length).toBe(componentProfiles.length);
			})
			.finally(() => {
				vueScanner.removeAppDir();
				expect(existsSync(appDir)).toBeFalsy();
			});
	});
});
